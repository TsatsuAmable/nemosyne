use std::collections::HashMap;

use crate::data::column::{Column, ColumnType};
use crate::data::dataset::Dataset;
use crate::data::value::Value;

/// Available built-in sample datasets in Phase 1.
pub fn make_sample(key: &str) -> Option<Dataset> {
    match key {
        "supply-chain" => Some(supply_chain_hierarchy()),
        "fraud-graph" => Some(fraud_graph()),
        "sensor-stream" => Some(sensor_stream()),
        "sales-table" => Some(sales_table(48)),
        "org-chart" => Some(org_chart(3)),
        "wind-field" => Some(wind_field(32)),
        "social-graph" => Some(social_graph(20)),
        "financial-series" => Some(financial_series(48, "MEMO")),
        "geo-cities" => Some(geo_cities(20)),
        "flow-process" => Some(flow_process(6)),
        _ => None,
    }
}

/// Deterministic LCG for synthetic data generation. Matches the spirit of
/// `src/utils/SeededRandom.js` without pulling in the full JS dependency.
struct SynthRng {
    state: u64,
}

impl SynthRng {
    fn new(seed: u64) -> Self {
        let mut s = seed;
        if s == 0 {
            s = 1;
        }
        Self { state: s }
    }

    fn next(&mut self) -> f64 {
        // Numerical Recipes LCG constants.
        self.state = self.state.wrapping_mul(16_807).wrapping_add(0) % 2_147_483_647;
        (self.state as f64) / 2_147_483_646.0
    }

    fn range_f64(&mut self, min: f64, max: f64) -> f64 {
        min + self.next() * (max - min)
    }

    fn range_usize(&mut self, min: usize, max: usize) -> usize {
        min + (self.next() * (max - min) as f64) as usize
    }
}

fn supply_chain_hierarchy() -> Dataset {
    let columns = vec![
        Column::new("name", ColumnType::Categorical),
        Column::new("level", ColumnType::Numeric),
        Column::new("region", ColumnType::Categorical),
        Column::new("inventory", ColumnType::Numeric),
        Column::new("riskScore", ColumnType::Numeric),
    ];
    let rows = vec![
        ("North America Hub", 0.0, "Americas", 12000.0, 0.2),
        ("EU Hub", 0.0, "Europe", 9800.0, 0.35),
        ("Asia Hub", 0.0, "Asia", 15400.0, 0.15),
        ("NYC Warehouse", 1.0, "Americas", 3400.0, 0.4),
        ("LA Warehouse", 1.0, "Americas", 2800.0, 0.3),
        ("Berlin Warehouse", 1.0, "Europe", 4100.0, 0.25),
        ("Paris Warehouse", 1.0, "Europe", 2900.0, 0.5),
        ("Tokyo Warehouse", 1.0, "Asia", 5200.0, 0.18),
        ("Singapore Warehouse", 1.0, "Asia", 4700.0, 0.22),
        ("Seoul DC", 2.0, "Asia", 1500.0, 0.6),
        ("Miami DC", 2.0, "Americas", 1100.0, 0.45),
        ("Munich DC", 2.0, "Europe", 1300.0, 0.28),
    ]
    .into_iter()
    .map(|(name, level, region, inventory, risk)| {
        let mut row = HashMap::new();
        row.insert("name".to_string(), Value::Text(name.to_string()));
        row.insert("level".to_string(), Value::Number(level));
        row.insert("region".to_string(), Value::Text(region.to_string()));
        row.insert("inventory".to_string(), Value::Number(inventory));
        row.insert("riskScore".to_string(), Value::Number(risk));
        row
    })
    .collect();
    let mut ds = Dataset::new("Global Supply Chain", columns, rows);
    ds.edges = Some(vec![]);
    ds
}

fn fraud_graph() -> Dataset {
    let columns = vec![
        Column::new("id", ColumnType::Categorical),
        Column::new("amount", ColumnType::Numeric),
        Column::new("isFraud", ColumnType::Categorical),
        Column::new("hour", ColumnType::Numeric),
    ];
    let rows = vec![
        ("A", 120.0, false, 9.0),
        ("B", 8500.0, true, 2.0),
        ("C", 300.0, false, 14.0),
        ("D", 9200.0, true, 3.0),
        ("E", 150.0, false, 11.0),
        ("F", 7800.0, true, 4.0),
        ("G", 200.0, false, 16.0),
        ("H", 11000.0, true, 1.0),
    ]
    .into_iter()
    .map(|(id, amount, is_fraud, hour)| {
        let mut row = HashMap::new();
        row.insert("id".to_string(), Value::Text(id.to_string()));
        row.insert("amount".to_string(), Value::Number(amount));
        row.insert(
            "isFraud".to_string(),
            Value::Text((if is_fraud { "true" } else { "false" }).to_string()),
        );
        row.insert("hour".to_string(), Value::Number(hour));
        row
    })
    .collect();
    let mut ds = Dataset::new("Transaction Fraud Graph", columns, rows);
    ds.edges = Some(vec![
        (0, 1),
        (1, 3),
        (2, 4),
        (3, 5),
        (4, 6),
        (5, 7),
        (0, 2),
    ]);
    ds
}

fn sensor_stream() -> Dataset {
    let columns = vec![
        Column::new("time", ColumnType::Temporal),
        Column::new("sensorId", ColumnType::Categorical),
        Column::new("temperature", ColumnType::Numeric),
        Column::new("vibration", ColumnType::Numeric),
    ];
    let rows = vec![
        ("2026-07-28T00:00:00", "S1", 22.1, 0.04),
        ("2026-07-28T01:00:00", "S1", 22.4, 0.05),
        ("2026-07-28T02:00:00", "S1", 23.0, 0.08),
        ("2026-07-28T03:00:00", "S1", 24.2, 0.12),
        ("2026-07-28T00:00:00", "S2", 19.5, 0.02),
        ("2026-07-28T01:00:00", "S2", 19.8, 0.03),
        ("2026-07-28T02:00:00", "S2", 20.2, 0.06),
        ("2026-07-28T03:00:00", "S2", 21.0, 0.09),
    ]
    .into_iter()
    .map(|(time, sensor, temp, vib)| {
        let mut row = HashMap::new();
        row.insert("time".to_string(), Value::Text(time.to_string()));
        row.insert("sensorId".to_string(), Value::Text(sensor.to_string()));
        row.insert("temperature".to_string(), Value::Number(temp));
        row.insert("vibration".to_string(), Value::Number(vib));
        row
    })
    .collect();
    Dataset::new("IoT Sensor Stream", columns, rows)
}

fn sales_table(rows: usize) -> Dataset {
    let columns = vec![
        Column::new("id", ColumnType::Categorical),
        Column::new("region", ColumnType::Categorical),
        Column::new("product", ColumnType::Categorical),
        Column::new("units", ColumnType::Numeric),
        Column::new("price", ColumnType::Numeric),
        Column::new("revenue", ColumnType::Numeric),
        Column::new("discount", ColumnType::Numeric),
    ];
    let regions = ["North", "South", "East", "West"];
    let products = ["Widget", "Gadget", "Thingama", "Doohickey"];
    let mut rng = SynthRng::new(1);
    let data: Vec<HashMap<String, Value>> = (0..rows)
        .map(|i| {
            let region = regions[i % regions.len()];
            let product = products[i % products.len()];
            let units = (20.0 + rng.next() * 480.0).floor();
            let price = 10.0 + ((i % 5) as f64) * 5.0;
            let revenue = units * price;
            let discount = if rng.next() > 0.8 { 0.2 } else { 0.0 };
            let mut row = HashMap::new();
            row.insert("id".to_string(), Value::Text(format!("S{}", i + 1)));
            row.insert("region".to_string(), Value::Text(region.to_string()));
            row.insert("product".to_string(), Value::Text(product.to_string()));
            row.insert("units".to_string(), Value::Number(units));
            row.insert("price".to_string(), Value::Number(price));
            row.insert("revenue".to_string(), Value::Number(revenue));
            row.insert("discount".to_string(), Value::Number(discount));
            row
        })
        .collect();
    Dataset::new("Sales Performance", columns, data)
}

fn org_chart(depth: usize) -> Dataset {
    let columns = vec![
        Column::new("id", ColumnType::Numeric),
        Column::new("name", ColumnType::Categorical),
        Column::new("level", ColumnType::Numeric),
        Column::new("parent", ColumnType::Numeric),
        Column::new("employees", ColumnType::Numeric),
        Column::new("budget", ColumnType::Numeric),
    ];
    let branching = [1, 3, 4, 2];
    let mut rng = SynthRng::new(2);
    let mut rows: Vec<HashMap<String, Value>> = Vec::new();
    let mut id_counter: usize = 1;

    fn add_node(
        rows: &mut Vec<HashMap<String, Value>>,
        id_counter: &mut usize,
        rng: &mut SynthRng,
        name: &str,
        level: usize,
        parent: Option<usize>,
    ) -> usize {
        let id = *id_counter;
        *id_counter += 1;
        let employees = (5.0 + rng.next() * 95.0).floor();
        let budget = employees * (10000.0 + rng.next() * 50000.0);
        let mut row = HashMap::new();
        row.insert("id".to_string(), Value::Number(id as f64));
        row.insert("name".to_string(), Value::Text(name.to_string()));
        row.insert("level".to_string(), Value::Number(level as f64));
        row.insert(
            "parent".to_string(),
            parent.map(|p| Value::Number(p as f64)).unwrap_or(Value::Null),
        );
        row.insert("employees".to_string(), Value::Number(employees));
        row.insert("budget".to_string(), Value::Number(budget));
        rows.push(row);
        id
    }

    let root = add_node(&mut rows, &mut id_counter, &mut rng, "CEO", 0, None);
    let level1: Vec<usize> = (0..branching.get(1).copied().unwrap_or(3))
        .map(|i| {
            let name = format!("VP-{}", (b'A' + i as u8) as char);
            add_node(&mut rows, &mut id_counter, &mut rng, &name, 1, Some(root))
        })
        .collect();
    let mut level2 = Vec::new();
    for &parent in &level1 {
        for i in 0..branching.get(2).copied().unwrap_or(3) {
            let name = format!("Dir-{}-{}", parent, i + 1);
            level2.push(add_node(
                &mut rows,
                &mut id_counter,
                &mut rng,
                &name,
                2,
                Some(parent),
            ));
        }
    }
    for &parent in &level2 {
        for i in 0..branching.get(3).copied().unwrap_or(3) {
            let name = format!("Team-{}-{}", parent, i + 1);
            add_node(&mut rows, &mut id_counter, &mut rng, &name, 3, Some(parent));
        }
    }

    let _ = depth; // depth is currently implicit via branching; kept for API parity.
    Dataset::new("Organization Chart", columns, rows)
}

fn wind_field(count: usize) -> Dataset {
    let columns = vec![
        Column::new("id", ColumnType::Categorical),
        Column::new("x", ColumnType::Numeric),
        Column::new("y", ColumnType::Numeric),
        Column::new("z", ColumnType::Numeric),
        Column::new("u", ColumnType::Numeric),
        Column::new("v", ColumnType::Numeric),
        Column::new("w", ColumnType::Numeric),
        Column::new("magnitude", ColumnType::Numeric),
    ];
    let mut rng = SynthRng::new(3);
    let mut rows: Vec<HashMap<String, Value>> = (0..count)
        .map(|i| {
            let u = rng.range_f64(-1.0, 1.0);
            let v = rng.range_f64(-0.25, 0.25);
            let w = rng.range_f64(-1.0, 1.0);
            let mut row = HashMap::new();
            row.insert("id".to_string(), Value::Text(format!("V{}", i)));
            row.insert("x".to_string(), Value::Number(rng.range_f64(-5.0, 5.0)));
            row.insert("y".to_string(), Value::Number(rng.range_f64(0.0, 4.0)));
            row.insert("z".to_string(), Value::Number(rng.range_f64(-10.0, 0.0)));
            row.insert("u".to_string(), Value::Number(u));
            row.insert("v".to_string(), Value::Number(v));
            row.insert("w".to_string(), Value::Number(w));
            row.insert("magnitude".to_string(), Value::Number(0.0));
            row
        })
        .collect();
    for row in &mut rows {
        let u = row.get("u").and_then(|v| v.as_number()).unwrap_or(0.0);
        let v = row.get("v").and_then(|v| v.as_number()).unwrap_or(0.0);
        let w = row.get("w").and_then(|v| v.as_number()).unwrap_or(0.0);
        row.insert("magnitude".to_string(), Value::Number((u * u + v * v + w * w).sqrt()));
    }
    Dataset::new("Wind Vector Field", columns, rows)
}

fn social_graph(nodes: usize) -> Dataset {
    let columns = vec![
        Column::new("id", ColumnType::Categorical),
        Column::new("group", ColumnType::Categorical),
        Column::new("influence", ColumnType::Numeric),
    ];
    let groups = ["A", "B", "C", "D"];
    let mut rng = SynthRng::new(4);
    let rows: Vec<HashMap<String, Value>> = (0..nodes)
        .map(|i| {
            let mut row = HashMap::new();
            row.insert("id".to_string(), Value::Text(format!("N{}", i)));
            row.insert(
                "group".to_string(),
                Value::Text(groups[i % groups.len()].to_string()),
            );
            row.insert("influence".to_string(), Value::Number((10.0 + rng.next() * 990.0).floor()));
            row
        })
        .collect();
    let mut edges: Vec<(usize, usize)> = Vec::new();
    for i in 0..nodes {
        let connections = 1 + rng.range_usize(0, 3);
        for _ in 0..connections {
            let target = rng.range_usize(0, nodes);
            if target != i {
                edges.push((i, target));
            }
        }
    }
    let mut ds = Dataset::new("Social Influence Graph", columns, rows);
    ds.edges = Some(edges);
    ds
}

fn financial_series(ticks: usize, symbol: &str) -> Dataset {
    let columns = vec![
        Column::new("time", ColumnType::Temporal),
        Column::new("symbol", ColumnType::Categorical),
        Column::new("open", ColumnType::Numeric),
        Column::new("high", ColumnType::Numeric),
        Column::new("low", ColumnType::Numeric),
        Column::new("close", ColumnType::Numeric),
        Column::new("volume", ColumnType::Numeric),
    ];
    let mut rng = SynthRng::new(5);
    let mut price = 100.0 + rng.next() * 50.0;
    let rows: Vec<HashMap<String, Value>> = (0..ticks)
        .map(|i| {
            let open = price;
            let change = (rng.next() - 0.48) * 4.0;
            let close = (open + change).max(10.0);
            let high = open.max(close) + rng.next() * 2.0;
            let low = open.min(close) - rng.next() * 2.0;
            let volume = (1000.0 + rng.next() * 9000.0).floor();
            price = close;
            let time = format!("2026-07-28T{:02}:00:00", i);
            let mut row = HashMap::new();
            row.insert("time".to_string(), Value::Text(time));
            row.insert("symbol".to_string(), Value::Text(symbol.to_string()));
            row.insert("open".to_string(), Value::Number(open));
            row.insert("high".to_string(), Value::Number(high));
            row.insert("low".to_string(), Value::Number(low));
            row.insert("close".to_string(), Value::Number(close));
            row.insert("volume".to_string(), Value::Number(volume));
            row
        })
        .collect();
    Dataset::new("Financial Series", columns, rows)
}

fn geo_cities(count: usize) -> Dataset {
    let columns = vec![
        Column::new("name", ColumnType::Categorical),
        Column::new("lat", ColumnType::Numeric),
        Column::new("lon", ColumnType::Numeric),
        Column::new("population", ColumnType::Numeric),
        Column::new("gdp", ColumnType::Numeric),
    ];
    let cities: Vec<(&str, f64, f64)> = vec![
        ("New York", 40.7, -74.0),
        ("London", 51.5, -0.1),
        ("Tokyo", 35.7, 139.7),
        ("Singapore", 1.3, 103.8),
        ("Sydney", -33.9, 151.2),
        ("Berlin", 52.5, 13.4),
        ("Sao Paulo", -23.5, -46.6),
        ("Mumbai", 19.1, 72.9),
        ("Lagos", 6.5, 3.4),
        ("Cairo", 30.0, 31.2),
        ("Mexico City", 19.4, -99.1),
        ("Bangkok", 13.7, 100.5),
        ("Istanbul", 41.0, 28.9),
        ("Seoul", 37.6, 127.0),
        ("Paris", 48.9, 2.3),
        ("Toronto", 43.7, -79.4),
        ("Dubai", 25.2, 55.3),
        ("Buenos Aires", -34.6, -58.4),
        ("Cape Town", -33.9, 18.4),
        ("Moscow", 55.8, 37.6),
    ];
    let mut rng = SynthRng::new(6);
    let rows: Vec<HashMap<String, Value>> = cities
        .into_iter()
        .take(count)
        .map(|(name, lat, lon)| {
            let population = (2.0 + rng.next() * 18.0).floor();
            let gdp = (50.0 + rng.next() * 450.0).floor();
            let mut row = HashMap::new();
            row.insert("name".to_string(), Value::Text(name.to_string()));
            row.insert("lat".to_string(), Value::Number(lat));
            row.insert("lon".to_string(), Value::Number(lon));
            row.insert("population".to_string(), Value::Number(population));
            row.insert("gdp".to_string(), Value::Number(gdp));
            row
        })
        .collect();
    Dataset::new("Global Cities", columns, rows)
}

fn flow_process(stages: usize) -> Dataset {
    let columns = vec![
        Column::new("id", ColumnType::Categorical),
        Column::new("stage", ColumnType::Numeric),
        Column::new("label", ColumnType::Categorical),
        Column::new("throughput", ColumnType::Numeric),
        Column::new("latency", ColumnType::Numeric),
    ];
    let mut rng = SynthRng::new(7);
    let rows: Vec<HashMap<String, Value>> = (0..stages)
        .map(|i| {
            let mut row = HashMap::new();
            row.insert("id".to_string(), Value::Text(format!("S{}", i)));
            row.insert("stage".to_string(), Value::Number(i as f64));
            row.insert("label".to_string(), Value::Text(format!("Stage {}", i + 1)));
            row.insert("throughput".to_string(), Value::Number((50.0 + rng.next() * 950.0).floor()));
            row.insert("latency".to_string(), Value::Number((10.0 + rng.next() * 200.0).floor()));
            row
        })
        .collect();
    let mut edges: Vec<(usize, usize)> = Vec::new();
    for i in 0..stages.saturating_sub(1) {
        edges.push((i, i + 1));
        if rng.next() > 0.6 {
            let skip = (i + 2).min(stages - 1);
            edges.push((i, skip));
        }
    }
    let mut ds = Dataset::new("Process Flow", columns, rows);
    ds.edges = Some(edges);
    ds
}
