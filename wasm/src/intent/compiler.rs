use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnSchema {
    pub name: String,
    #[serde(default)]
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatasetSchema {
    pub columns: Vec<ColumnSchema>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedIntent {
    pub kind: String,
    pub raw_query: String,
    pub matched_columns: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub predicate: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operation: Option<serde_json::Value>,
    pub description: String,
    pub confidence: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warnings: Option<Vec<String>>,
}

fn resolve_column(input: &str, columns: &[String]) -> Option<String> {
    let clean = input.trim().to_lowercase();
    for col in columns {
        if col.to_lowercase() == clean {
            return Some(col.clone());
        }
    }
    let partials: Vec<&String> = columns
        .iter()
        .filter(|col| col.to_lowercase().contains(&clean))
        .collect();
    if partials.len() == 1 {
        Some(partials[0].clone())
    } else {
        None
    }
}

pub fn compile_intent(query: &str, schema: &DatasetSchema) -> ParsedIntent {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return ParsedIntent {
            kind: "unknown".to_string(),
            raw_query: query.to_string(),
            matched_columns: vec![],
            predicate: None,
            operation: None,
            description: "Empty query".to_string(),
            confidence: 0.0,
            warnings: Some(vec!["Query cannot be empty".to_string()]),
        };
    }

    let lower = trimmed.to_lowercase();
    let columns: Vec<String> = schema.columns.iter().map(|c| c.name.clone()).collect();

    if matches!(lower.as_str(), "reset" | "clear all" | "reset filters" | "clear") {
        return ParsedIntent {
            kind: "reset".to_string(),
            raw_query: query.to_string(),
            matched_columns: vec![],
            predicate: None,
            operation: None,
            description: "Reset all active filters and transformations".to_string(),
            confidence: 1.0,
            warnings: None,
        };
    }

    if let Some(intent) = try_anomaly(&lower, query, &columns) {
        return intent;
    }
    if let Some(intent) = try_aggregate(&lower, query, &columns) {
        return intent;
    }
    if let Some(intent) = try_between_filter(&lower, query, &columns) {
        return intent;
    }
    if let Some(intent) = try_comparison_filter(&lower, query, &columns) {
        return intent;
    }
    if let Some(intent) = try_in_filter(&lower, query, &columns) {
        return intent;
    }
    if let Some(intent) = try_eq_filter(&lower, query, &columns) {
        return intent;
    }

    if lower.contains("cluster") || lower.contains("k-means") {
        return ParsedIntent {
            kind: "cluster".to_string(),
            raw_query: query.to_string(),
            matched_columns: vec![],
            predicate: None,
            operation: Some(serde_json::json!({"op": "k_means", "k": 3})),
            description: "Cluster dataset into topological groupings using K-means".to_string(),
            confidence: 0.85,
            warnings: None,
        };
    }

    ParsedIntent {
        kind: "unknown".to_string(),
        raw_query: query.to_string(),
        matched_columns: vec![],
        predicate: None,
        operation: None,
        description: format!(
            "Unable to compile query into a deterministic analytical operation: \"{}\"",
            query
        ),
        confidence: 0.0,
        warnings: Some(vec![
            "No matching column or supported analytical syntax pattern found".to_string(),
        ]),
    }
}

fn try_anomaly(lower: &str, raw: &str, columns: &[String]) -> Option<ParsedIntent> {
    let col_name = extract_anomaly_column(lower, columns)?;
    let is_zscore = lower.contains("zscore") || lower.contains("z-score");
    let op = if is_zscore {
        serde_json::json!({"op": "anomaly_zscore", "column": col_name, "sensitivity": 3.0})
    } else {
        serde_json::json!({"op": "anomaly_iqr", "column": col_name, "sensitivity": 1.5})
    };
    let method = if is_zscore { "Z-score" } else { "IQR" };
    Some(ParsedIntent {
        kind: "anomaly".to_string(),
        raw_query: raw.to_string(),
        matched_columns: vec![col_name.clone()],
        predicate: None,
        operation: Some(op),
        description: format!("Detect statistical anomalies on column '{}' using {}", col_name, method),
        confidence: 0.95,
        warnings: None,
    })
}

fn extract_anomaly_column(lower: &str, columns: &[String]) -> Option<String> {
    let anomaly_keywords = ["outlier", "outliers", "anomaly", "anomalies"];
    for kw in &anomaly_keywords {
        if let Some(pos) = lower.find(kw) {
            let after = &lower[pos + kw.len()..];
            let after_trimmed = after.trim_start_matches(|c: char| c == ' ' || c == 's');
            let after_trimmed = after_trimmed
                .trim_start_matches("in ")
                .trim_start_matches("on ")
                .trim_start_matches("for ")
                .trim_start_matches("by ");
            let word = after_trimmed
                .split(|c: char| c.is_whitespace())
                .next()
                .unwrap_or("");
            if !word.is_empty() {
                if let Some(col) = resolve_column(word, columns) {
                    return Some(col);
                }
            }

            let before = &lower[..pos];
            let before_word = before
                .trim()
                .rsplit(|c: char| c.is_whitespace())
                .next()
                .unwrap_or("");
            if !before_word.is_empty() {
                if let Some(col) = resolve_column(before_word, columns) {
                    return Some(col);
                }
            }
        }
    }
    None
}

fn try_aggregate(lower: &str, raw: &str, columns: &[String]) -> Option<ParsedIntent> {
    let agg_fns = [
        "sum", "mean", "median", "min", "max", "count", "average", "avg",
    ];
    for func in &agg_fns {
        if let Some(pos) = lower.find(func) {
            let after = &lower[pos + func.len()..].trim_start();
            let parts: Vec<&str> = after.splitn(4, |c: char| c.is_whitespace()).collect();
            if parts.len() >= 3 {
                let measure_word = parts[0];
                let prep = parts[1];
                if ["by", "per"].contains(&prep) || after.contains("grouped by") {
                    let group_word = if prep == "grouped" && parts.len() > 2 {
                        parts.get(3).or(parts.get(2)).copied().unwrap_or("")
                    } else {
                        parts[2]
                    };
                    let measure_col = resolve_column(measure_word, columns);
                    let group_col = resolve_column(group_word, columns);
                    if let (Some(m), Some(g)) = (measure_col, group_col) {
                        let fn_name = match *func {
                            "average" | "avg" => "mean",
                            other => other,
                        };
                        let op = serde_json::json!({
                            "op": "aggregate",
                            "group_by": g,
                            "aggregators": [{"column": m, "function": fn_name}]
                        });
                        return Some(ParsedIntent {
                            kind: "aggregate".to_string(),
                            raw_query: raw.to_string(),
                            matched_columns: vec![m.clone(), g.clone()],
                            predicate: None,
                            operation: Some(op),
                            description: format!("Aggregate '{}' ({}) grouped by '{}'", m, fn_name, g),
                            confidence: 0.95,
                            warnings: None,
                        });
                    }
                }
            }
        }
    }
    None
}

fn try_between_filter(lower: &str, raw: &str, columns: &[String]) -> Option<ParsedIntent> {
    if !lower.contains("between") {
        return None;
    }
    let parts: Vec<&str> = lower.split_whitespace().collect();
    let between_idx = parts.iter().position(|&w| w == "between")?;
    if between_idx == 0 || between_idx + 3 > parts.len() {
        return None;
    }
    let col_word = if parts[between_idx - 1] == "is" && between_idx >= 2 {
        parts[between_idx - 2]
    } else {
        parts[between_idx - 1]
    };
    let lo: f64 = parts[between_idx + 1].parse().ok()?;
    let and_idx = between_idx + 2;
    if and_idx >= parts.len() {
        return None;
    }
    let hi_idx = if parts[and_idx] == "and" || parts[and_idx] == "to" {
        and_idx + 1
    } else {
        and_idx
    };
    if hi_idx >= parts.len() {
        return None;
    }
    let hi: f64 = parts[hi_idx].parse().ok()?;
    let col = resolve_column(col_word, columns)?;
    let pred = serde_json::json!({"op": "between", "column": col, "lo": lo, "hi": hi});
    Some(ParsedIntent {
        kind: "filter".to_string(),
        raw_query: raw.to_string(),
        matched_columns: vec![col.clone()],
        predicate: Some(pred.clone()),
        operation: Some(serde_json::json!({"op": "filter", "predicate": pred})),
        description: format!("Filter '{}' between {} and {}", col, lo, hi),
        confidence: 0.95,
        warnings: None,
    })
}

fn try_comparison_filter(lower: &str, raw: &str, columns: &[String]) -> Option<ParsedIntent> {
    let ops = [
        (">=", "gte"),
        ("<=", "lte"),
        (">", "gt"),
        ("<", "lt"),
        ("greater than", "gt"),
        ("less than", "lt"),
        ("at least", "gte"),
        ("at most", "lte"),
    ];
    for (pattern, op_kind) in &ops {
        if let Some(pos) = lower.find(pattern) {
            let before = lower[..pos].trim();
            let after = lower[pos + pattern.len()..].trim();
            let col_word = before.rsplit_once(' ').map(|(_, w)| w).unwrap_or(before);
            let val_word = after.split_whitespace().next().unwrap_or("");
            let col = resolve_column(col_word, columns)?;
            let val: f64 = val_word.parse().ok()?;
            let pred = serde_json::json!({"op": op_kind, "column": col, "value": val});
            return Some(ParsedIntent {
                kind: "filter".to_string(),
                raw_query: raw.to_string(),
                matched_columns: vec![col.clone()],
                predicate: Some(pred.clone()),
                operation: Some(serde_json::json!({"op": "filter", "predicate": pred})),
                description: format!("Filter '{}' {} {}", col, op_kind, val),
                confidence: 0.95,
                warnings: None,
            });
        }
    }
    None
}

fn try_in_filter(lower: &str, raw: &str, columns: &[String]) -> Option<ParsedIntent> {
    let in_pos = lower.find(" in (")?;
    let col_word = lower[..in_pos].rsplit_once(' ').map(|(_, w)| w).unwrap_or(&lower[..in_pos]);
    let paren_start = lower[in_pos..].find('(')? + in_pos + 1;
    let paren_end = lower[paren_start..].find(')')? + paren_start;
    let values_str = &lower[paren_start..paren_end];
    let values: Vec<String> = values_str
        .split(',')
        .map(|s| s.trim().trim_matches(|c| c == '\'' || c == '"').to_string())
        .collect();
    let col = resolve_column(col_word, columns)?;
    let pred = serde_json::json!({"op": "in", "column": col, "values": values});
    Some(ParsedIntent {
        kind: "filter".to_string(),
        raw_query: raw.to_string(),
        matched_columns: vec![col.clone()],
        predicate: Some(pred.clone()),
        operation: Some(serde_json::json!({"op": "filter", "predicate": pred})),
        description: format!("Filter '{}' in [{}]", col, values.join(", ")),
        confidence: 0.9,
        warnings: None,
    })
}

fn try_eq_filter(lower: &str, raw: &str, columns: &[String]) -> Option<ParsedIntent> {
    if lower.contains("between") {
        return None;
    }
    let eq_ops = ["==", "=", " is "];
    for op in &eq_ops {
        if let Some(pos) = lower.find(op) {
            let before = lower[..pos].trim();
            let after = lower[pos + op.len()..].trim();
            let col_word = before.rsplit_once(' ').map(|(_, w)| w).unwrap_or(before);
            let val_word = after
                .split_whitespace()
                .next()
                .unwrap_or("")
                .trim_matches(|c| c == '\'' || c == '"');
            if val_word.is_empty() {
                continue;
            }
            let col = resolve_column(col_word, columns)?;
            let value: serde_json::Value = if let Ok(n) = val_word.parse::<f64>() {
                serde_json::json!(n)
            } else if val_word == "true" {
                serde_json::json!(true)
            } else if val_word == "false" {
                serde_json::json!(false)
            } else {
                serde_json::json!(val_word)
            };
            let pred = serde_json::json!({"op": "eq", "column": col, "value": value});
            return Some(ParsedIntent {
                kind: "filter".to_string(),
                raw_query: raw.to_string(),
                matched_columns: vec![col.clone()],
                predicate: Some(pred.clone()),
                operation: Some(serde_json::json!({"op": "filter", "predicate": pred})),
                description: format!("Filter '{}' == {}", col, value),
                confidence: 0.9,
                warnings: None,
            });
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_schema() -> DatasetSchema {
        DatasetSchema {
            columns: vec![
                ColumnSchema { name: "amount".to_string(), kind: "numeric".to_string() },
                ColumnSchema { name: "risk_score".to_string(), kind: "numeric".to_string() },
                ColumnSchema { name: "account_type".to_string(), kind: "categorical".to_string() },
                ColumnSchema { name: "region".to_string(), kind: "categorical".to_string() },
            ],
        }
    }

    #[test]
    fn compiles_reset() {
        let result = compile_intent("reset", &test_schema());
        assert_eq!(result.kind, "reset");
        assert_eq!(result.confidence, 1.0);
    }

    #[test]
    fn compiles_anomaly_detection() {
        let result = compile_intent("find outliers in amount", &test_schema());
        assert_eq!(result.kind, "anomaly");
        assert_eq!(result.matched_columns, vec!["amount"]);
        assert_eq!(result.confidence, 0.95);
    }

    #[test]
    fn compiles_aggregate() {
        let result = compile_intent("sum amount by account_type", &test_schema());
        assert_eq!(result.kind, "aggregate");
        assert_eq!(result.matched_columns, vec!["amount", "account_type"]);
    }

    #[test]
    fn compiles_between_filter() {
        let result = compile_intent("amount between 100 and 500", &test_schema());
        assert_eq!(result.kind, "filter");
        assert_eq!(result.matched_columns, vec!["amount"]);
    }

    #[test]
    fn compiles_comparison_filter() {
        let result = compile_intent("risk_score > 0.8", &test_schema());
        assert_eq!(result.kind, "filter");
        assert_eq!(result.matched_columns, vec!["risk_score"]);
    }

    #[test]
    fn compiles_in_filter() {
        let result = compile_intent("region in (US, EU)", &test_schema());
        assert_eq!(result.kind, "filter");
        assert_eq!(result.matched_columns, vec!["region"]);
    }

    #[test]
    fn compiles_cluster() {
        let result = compile_intent("cluster the data", &test_schema());
        assert_eq!(result.kind, "cluster");
        assert_eq!(result.confidence, 0.85);
    }

    #[test]
    fn returns_unknown_for_gibberish() {
        let result = compile_intent("xyzzy plugh", &test_schema());
        assert_eq!(result.kind, "unknown");
        assert_eq!(result.confidence, 0.0);
    }
}
