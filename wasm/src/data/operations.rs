use std::collections::HashMap;

use crate::data::column::{Column, ColumnType};
use crate::data::dataset::Dataset;
use crate::data::value::Value;

pub fn filter(dataset: &Dataset, predicate: impl Fn(&HashMap<String, Value>) -> bool) -> Dataset {
    let rows: Vec<HashMap<String, Value>> = dataset.rows.iter().filter(|r| predicate(r)).cloned().collect();
    dataset.clone_with_rows(rows, "[filtered]")
}

pub fn sort(dataset: &Dataset, column_name: &str, ascending: bool) -> Dataset {
    let mut rows = dataset.rows.clone();
    rows.sort_by(|a, b| {
        let av = a.get(column_name); let bv = b.get(column_name);
        if av.is_none() { return std::cmp::Ordering::Greater; }
        if bv.is_none() { return std::cmp::Ordering::Less; }
        let ord = compare_values(av.unwrap(), bv.unwrap());
        if ascending { ord } else { ord.reverse() }
    });
    dataset.clone_with_rows(rows, &format!("[sorted: {}]", column_name))
}

fn compare_values(a: &Value, b: &Value) -> std::cmp::Ordering {
    match (a.as_number(), b.as_number()) {
        (Some(an), Some(bn)) => an.partial_cmp(&bn).unwrap_or(std::cmp::Ordering::Equal),
        _ => a.to_key_string().cmp(&b.to_key_string()),
    }
}

pub fn aggregate(
    dataset: &Dataset,
    group_by: &str,
    aggregator: impl Fn(&[&HashMap<String, Value>]) -> HashMap<String, Value>,
) -> Dataset {
    use std::collections::BTreeMap;
    let mut groups: BTreeMap<String, Vec<&HashMap<String, Value>>> = BTreeMap::new();
    for row in &dataset.rows {
        let key = row.get(group_by).map(|v| v.to_key_string()).unwrap_or_default();
        groups.entry(key).or_default().push(row);
    }
    let rows: Vec<HashMap<String, Value>> = groups.values().map(|g| aggregator(g)).collect();
    dataset.clone_with_rows(rows, &format!("[aggregated by {}]", group_by))
}

pub fn slice(dataset: &Dataset, start: usize, end: usize) -> Dataset {
    let rows = dataset.rows[start.min(dataset.rows.len())..end.min(dataset.rows.len())].to_vec();
    dataset.clone_with_rows(rows, &format!("[slice {}-{}]", start, end))
}

pub fn default_sum_aggregator(
    group_by: &str,
    group_rows: &[&HashMap<String, Value>],
) -> HashMap<String, Value> {
    let mut result = HashMap::new();
    if let Some(first) = group_rows.first() {
        if let Some(key) = first.get(group_by) { result.insert(group_by.to_string(), key.clone()); }
    }
    for row in group_rows {
        for (k, v) in *row {
            if k == group_by { continue; }
            if let Some(n) = v.as_number() {
                let entry = result.entry(k.clone()).or_insert_with(|| Value::Number(0.0));
                if let Value::Number(acc) = entry { *acc += n; }
            }
        }
    }
    result
}

pub fn anomaly_iqr(dataset: &Dataset, column_name: &str, sensitivity: f64) -> Dataset {
    let values: Vec<f64> = dataset.get_column_values(column_name).into_iter()
        .filter_map(|v| v.and_then(|val| val.as_number())).collect();
    let mut sorted = values.clone();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let q1 = percentile(&sorted, 0.25); let q3 = percentile(&sorted, 0.75); let iqr = q3 - q1;
    let lower = q1 - sensitivity * iqr; let upper = q3 + sensitivity * iqr;
    let mut rows = dataset.rows.clone();
    for row in &mut rows {
        let score = if let Some(v) = row.get(column_name).and_then(|v| v.as_number()) {
            if v < lower { (lower - v) / iqr.abs().max(1e-9) }
            else if v > upper { (v - upper) / iqr.abs().max(1e-9) } else { 0.0 }
        } else { 0.0 };
        row.insert("_anomaly".to_string(), Value::Bool(score > 0.0));
        row.insert("_anomalyScore".to_string(), Value::Number(score));
    }
    let mut columns = dataset.columns.clone();
    ensure_column(&mut columns, "_anomaly", ColumnType::Categorical);
    ensure_column(&mut columns, "_anomalyScore", ColumnType::Numeric);
    let mut result = dataset.clone_with_rows(rows, "[anomaly:iqr]"); result.columns = columns; result
}

fn percentile(sorted: &[f64], p: f64) -> f64 {
    if sorted.is_empty() { return 0.0; }
    let idx = p * (sorted.len() - 1) as f64; let low = idx.floor() as usize; let high = idx.ceil() as usize;
    if low == high { sorted[low] } else { let t = idx - low as f64; sorted[low] * (1.0 - t) + sorted[high] * t }
}

fn ensure_column(columns: &mut Vec<Column>, name: &str, ty: ColumnType) {
    if !columns.iter().any(|c| c.name == name) { columns.push(Column::new(name, ty)); }
}

fn complete_case_matrix(dataset: &Dataset, feature_names: &[String]) -> (Vec<Vec<f64>>, Vec<usize>) {
    let mut values = Vec::new(); let mut source_row_indices = Vec::new();
    for (source_row, row) in dataset.rows.iter().enumerate() {
        let mut point = Vec::with_capacity(feature_names.len()); let mut eligible = true;
        for name in feature_names {
            match row.get(name).and_then(|value| value.as_number()) {
                Some(value) if value.is_finite() => point.push(value),
                _ => { eligible = false; break; }
            }
        }
        if eligible { source_row_indices.push(source_row); values.push(point); }
    }
    (values, source_row_indices)
}

fn cluster_result(
    dataset: &Dataset,
    source_row_indices: &[usize],
    assignments: &[i32],
    name_suffix: &str,
) -> Dataset {
    debug_assert_eq!(source_row_indices.len(), assignments.len());
    let mut rows = dataset.rows.clone();
    for row in &mut rows { row.insert("_cluster".to_string(), Value::Null); }
    for (&source_row, &assignment) in source_row_indices.iter().zip(assignments) {
        if let Some(row) = rows.get_mut(source_row) { row.insert("_cluster".to_string(), Value::Number(assignment as f64)); }
    }
    let mut columns = dataset.columns.clone(); ensure_column(&mut columns, "_cluster", ColumnType::Numeric);
    let mut result = dataset.clone_with_rows(rows, name_suffix); result.columns = columns; result
}

pub fn k_means(dataset: &Dataset, k: usize, feature_columns: Option<&[&str]>) -> Dataset {
    let numeric_names: Vec<String> = feature_columns.map(|cols| cols.iter().map(|c| c.to_string()).collect())
        .unwrap_or_else(|| dataset.numeric_columns().into_iter().map(|c| c.name.clone()).collect());
    if numeric_names.is_empty() {
        let source_rows: Vec<usize> = (0..dataset.row_count()).collect();
        return cluster_result(dataset, &source_rows, &vec![0i32; source_rows.len()], "[clustered]");
    }
    let (values, source_rows) = complete_case_matrix(dataset, &numeric_names);
    if values.is_empty() { return cluster_result(dataset, &[], &[], "[clustered]"); }
    let effective_k = k.min(values.len()).max(1); let mut rng = Lcg::new(dataset.fingerprint_seed());
    let mut centroids = kmeans_plus_plus(&values, effective_k, &mut rng); let mut assignments = vec![0usize; values.len()];
    for _ in 0..20 {
        for (i, v) in values.iter().enumerate() {
            let mut best = 0usize; let mut best_dist = f64::INFINITY;
            for (j, c) in centroids.iter().enumerate() { let d = squared_euclidean(v, c); if d < best_dist { best_dist = d; best = j; } }
            assignments[i] = best;
        }
        let dim = numeric_names.len(); let mut new_centroids: Vec<Vec<f64>> = centroids.iter().map(|_| vec![0.0; dim]).collect();
        let mut counts = vec![0usize; effective_k];
        for (i, v) in values.iter().enumerate() { let a = assignments[i]; counts[a] += 1; for (d, val) in v.iter().enumerate() { new_centroids[a][d] += val; } }
        for (i, c) in new_centroids.iter_mut().enumerate() { if counts[i] == 0 { continue; } for val in c.iter_mut() { *val /= counts[i] as f64; } }
        centroids = new_centroids;
    }
    let assignments: Vec<i32> = assignments.into_iter().map(|v| v as i32).collect();
    cluster_result(dataset, &source_rows, &assignments, "[clustered]")
}

fn squared_euclidean(a: &[f64], b: &[f64]) -> f64 { a.iter().zip(b.iter()).map(|(x,y)| { let d=x-y; d*d }).sum() }
fn euclidean(a: &[f64], b: &[f64]) -> f64 { squared_euclidean(a,b).sqrt() }

struct Lcg { state: u32 }
impl Lcg {
    fn new(seed: u32) -> Self { let mut s = seed % 2_147_483_647; if s == 0 { s=1; } Self { state:s } }
    fn next(&mut self) -> f64 { self.state = (self.state as u64 * 16_807 % 2_147_483_647) as u32; (self.state - 1) as f64 / 2_147_483_646.0 }
}
fn kmeans_plus_plus(values: &[Vec<f64>], k: usize, rng: &mut Lcg) -> Vec<Vec<f64>> {
    let mut centroids=Vec::new(); if values.is_empty(){return centroids;} centroids.push(values[(rng.next()*values.len() as f64) as usize].clone());
    let mut distances=vec![0.0;values.len()];
    while centroids.len()<k { let mut total=0.0; for (i,v) in values.iter().enumerate(){ let mut best=f64::INFINITY; for c in &centroids { let d=squared_euclidean(v,c); if d<best{best=d;} } distances[i]=best; total+=best; }
        let target=rng.next()*total; let mut accum=0.0; let mut chosen=0usize; for (i,d) in distances.iter().enumerate(){accum+=d;if accum>=target{chosen=i;break;}} centroids.push(values[chosen].clone()); }
    centroids
}

fn leaves(node: usize, n: usize, parent_of: &[i64]) -> Vec<usize> {
    let mut result=Vec::new(); let mut stack=vec![node];
    while let Some(current)=stack.pop(){ if current<n{result.push(current);continue;} let children:Vec<usize>=parent_of.iter().enumerate().filter(|(_,p)|**p==current as i64).map(|(i,_)|i).collect(); stack.extend(children.into_iter().rev()); }
    result
}

pub fn hierarchical(dataset:&Dataset, feature_columns:Option<&[&str]>, linkage:&str, target_clusters:usize)->Dataset{
    let numeric_names:Vec<String>=feature_columns.map(|cols|cols.iter().map(|c|c.to_string()).collect()).unwrap_or_else(||dataset.numeric_columns().into_iter().map(|c|c.name.clone()).collect());
    if numeric_names.is_empty()||dataset.row_count()==0{let source_rows:Vec<usize>=(0..dataset.row_count()).collect();return cluster_result(dataset,&source_rows,&vec![0i32;source_rows.len()],"[hierarchical]");}
    let (values,source_rows)=complete_case_matrix(dataset,&numeric_names); if values.is_empty(){return cluster_result(dataset,&[],&[],"[hierarchical]");} let n=values.len();
    #[derive(Clone)] struct Cluster{id:usize,members:Vec<usize>,centroid:Vec<f64>}
    let mut clusters:Vec<Cluster>=values.iter().enumerate().map(|(i,v)|Cluster{id:i,members:vec![i],centroid:v.clone()}).collect(); let mut history=Vec::new(); let mut next_id=n;
    fn cluster_distance(a:&Cluster,b:&Cluster,values:&[Vec<f64>],linkage:&str)->f64{let mut best=if linkage=="single"{f64::INFINITY}else{f64::NEG_INFINITY};let mut total=0.0;let mut pairs=0usize;for &i in &a.members{for &j in &b.members{let d=euclidean(&values[i],&values[j]);if linkage=="single"{if d<best{best=d;}}else if linkage=="complete"{if d>best{best=d;}}else{total+=d;pairs+=1;}}}if linkage=="average"{if pairs>0{total/pairs as f64}else{0.0}}else{best}}
    fn merge(a:&Cluster,b:&Cluster,new_id:usize,values:&[Vec<f64>])->Cluster{let members:Vec<usize>=a.members.iter().chain(b.members.iter()).copied().collect();let dim=values[0].len();let mut centroid=vec![0.0;dim];for &idx in &members{for(d,val)in values[idx].iter().enumerate(){centroid[d]+=val;}}for val in &mut centroid{*val/=members.len() as f64;}Cluster{id:new_id,members,centroid}}
    while clusters.len()>1{let mut best_i=0;let mut best_j=1;let mut best_dist=f64::INFINITY;for i in 0..clusters.len(){for j in i+1..clusters.len(){let d=cluster_distance(&clusters[i],&clusters[j],&values,linkage);if d<best_dist{best_dist=d;best_i=i;best_j=j;}}}let merged=merge(&clusters[best_i],&clusters[best_j],next_id,&values);history.push((clusters[best_i].id,clusters[best_j].id,best_dist));clusters.remove(best_j);clusters[best_i]=merged;next_id+=1;}
    let mut parent_of:Vec<i64>=vec![-1;n];for(a,b,_)in &history{let node=next_id;parent_of[*a]=node as i64;parent_of[*b]=node as i64;parent_of.push(-1);next_id+=1;}
    fn children_of(node:usize,parent_of:&[i64])->Vec<usize>{parent_of.iter().enumerate().filter(|(_,p)|**p==node as i64).map(|(i,_)|i).collect()}
    let root=parent_of.len()-1;let mut candidates=vec![root];while candidates.len()<target_clusters{let split=candidates.iter().position(|node|*node>=n);if let Some(idx)=split{let node=candidates[idx];let kids=children_of(node,&parent_of);candidates.splice(idx..=idx,kids);}else{break;}}
    let mut assignments=vec![0usize;n];for(c,node)in candidates.iter().enumerate(){for leaf in leaves(*node,n,&parent_of){assignments[leaf]=c;}}
    let assignments:Vec<i32>=assignments.into_iter().map(|v|v as i32).collect();cluster_result(dataset,&source_rows,&assignments,"[hierarchical]")
}

/// Apply DBSCAN semantics to a precomputed Rust-authoritative neighbourhood.
/// This is shared by exact/grid and governed bounded-approximation paths, so
/// approximation changes only neighbour discovery, not cluster labelling.
pub fn dbscan_from_neighbourhood(
    dataset: &Dataset,
    min_points: usize,
    cloud: &crate::data::neighbourhood::IndexedPointCloud,
    csr: &crate::data::neighbourhood::RaggedNeighbourhood,
    suffix: &str,
) -> Dataset {
    let n = cloud.n;
    if n == 0 { return cluster_result(dataset, &[], &[], suffix); }
    debug_assert_eq!(csr.node_count(), n);
    let mut labels: Vec<Option<i32>> = vec![None; n]; let mut cluster_id=0i32;
    for i in 0..n {
        if labels[i].is_some(){continue;}
        let neighbours:Vec<usize>=csr.neighbors(i).map(|(j,_)|j).collect();
        if neighbours.len()<min_points{labels[i]=Some(-1);continue;}
        labels[i]=Some(cluster_id);let mut seeds=neighbours;let mut s=0usize;
        while s<seeds.len(){let j=seeds[s];if labels[j]==Some(-1){labels[j]=Some(cluster_id);}if labels[j].is_some(){s+=1;continue;}labels[j]=Some(cluster_id);let j_neighbours:Vec<usize>=csr.neighbors(j).map(|(k,_)|k).collect();if j_neighbours.len()>=min_points{seeds.extend(j_neighbours);}s+=1;}
        cluster_id+=1;
    }
    let assignments:Vec<i32>=labels.into_iter().map(|label|label.unwrap_or(-1)).collect();
    cluster_result(dataset,&cloud.source_row_indices,&assignments,suffix)
}

pub fn dbscan(dataset:&Dataset,eps:f64,min_points:usize,feature_columns:Option<&[&str]>)->Dataset{
    let numeric_names:Vec<String>=feature_columns.map(|cols|cols.iter().map(|c|c.to_string()).collect()).unwrap_or_else(||dataset.numeric_columns().into_iter().map(|c|c.name.clone()).collect());
    if numeric_names.is_empty(){let source_rows:Vec<usize>=(0..dataset.row_count()).collect();return cluster_result(dataset,&source_rows,&vec![0i32;source_rows.len()],"[dbscan]");}
    let cloud=match crate::data::neighbourhood::PointCloud::from_dataset(dataset,&numeric_names){Ok(cloud)=>cloud,Err(_)=>return dataset.clone()};
    let (csr,_)=if cloud.n>8192{crate::data::neighbourhood::GridSparseIndex::new(eps).radius_neighbourhood(&cloud,eps)}else{crate::data::neighbourhood::ExactIndex.radius_neighbourhood(&cloud,eps)};
    dbscan_from_neighbourhood(dataset,min_points,&cloud,&csr,"[dbscan]")
}

#[cfg(test)]
mod tests {
    use super::*; use crate::data::column::ColumnType; use crate::data::dataset::Dataset; use crate::data::value::Value;
    fn sample_dataset()->Dataset{let columns=vec![Column::new("name",ColumnType::Categorical),Column::new("age",ColumnType::Numeric)];let rows=vec![{let mut r=HashMap::new();r.insert("name".to_string(),Value::Text("Alice".to_string()));r.insert("age".to_string(),Value::Number(30.0));r},{let mut r=HashMap::new();r.insert("name".to_string(),Value::Text("Bob".to_string()));r.insert("age".to_string(),Value::Number(25.0));r}];Dataset::new("sample",columns,rows)}
    #[test]fn filter_keeps_matching_rows(){let ds=sample_dataset();let filtered=filter(&ds,|r|r.get("age").and_then(|v|v.as_number()).map(|a|a>26.0).unwrap_or(false));assert_eq!(filtered.row_count(),1);}
    #[test]fn sort_orders_by_column(){let ds=sample_dataset();let sorted=sort(&ds,"age",true);let ages:Vec<f64>=sorted.get_column_values("age").into_iter().filter_map(|v|v.and_then(|val|val.as_number())).collect();assert_eq!(ages,vec![25.0,30.0]);}
    #[test]fn aggregate_sums_numeric_columns(){let ds=sample_dataset();let aggregated=aggregate(&ds,"name",|group|default_sum_aggregator("name",group));assert_eq!(aggregated.row_count(),2);}
    #[test]fn slice_returns_subrange(){assert_eq!(slice(&sample_dataset(),0,1).row_count(),1);}
    #[test]fn k_means_assigns_clusters(){let clustered=k_means(&sample_dataset(),2,None);assert_eq!(clustered.row_count(),2);assert!(clustered.get_column("_cluster").is_some());}
    #[test]fn hierarchical_assigns_clusters(){assert_eq!(hierarchical(&sample_dataset(),None,"average",2).row_count(),2);}
    #[test]fn leaves_handles_deep_merge_histories_without_recursion(){let depth=20_000;let mut parent_of=vec![-1;depth+1];for node in 1..=depth{parent_of[node-1]=node as i64;}assert_eq!(leaves(depth,1,&parent_of),vec![0]);}
    #[test]fn dbscan_assigns_clusters(){assert_eq!(dbscan(&sample_dataset(),10.0,1,None).row_count(),2);}
    fn missing_metric_fixture()->Dataset{Dataset::new("missing-metric",vec![Column::new("x",ColumnType::Numeric),Column::new("y",ColumnType::Numeric)],vec![HashMap::from([("x".to_string(),Value::Number(0.0)),("y".to_string(),Value::Number(0.0))]),HashMap::from([("x".to_string(),Value::Null),("y".to_string(),Value::Number(0.1))]),HashMap::from([("x".to_string(),Value::Number(0.2)),("y".to_string(),Value::Number(0.2))])])}
    fn assert_middle_row_excluded(clustered:&Dataset){assert!(matches!(clustered.rows[1].get("_cluster"),Some(Value::Null)));assert!(matches!(clustered.rows[0].get("_cluster"),Some(Value::Number(_))));assert!(matches!(clustered.rows[2].get("_cluster"),Some(Value::Number(_))));}
    #[test]fn rf007_kmeans_excludes_missing_feature_tuple_instead_of_zero_imputing(){assert_middle_row_excluded(&k_means(&missing_metric_fixture(),1,Some(&["x","y"])));}
    #[test]fn rf007_hierarchical_excludes_missing_feature_tuple_instead_of_zero_imputing(){assert_middle_row_excluded(&hierarchical(&missing_metric_fixture(),Some(&["x","y"]),"average",1));}
    #[test]fn rf007_dbscan_excluded_row_is_null_not_noise_or_another_rows_label(){assert_middle_row_excluded(&dbscan(&missing_metric_fixture(),1.0,1,Some(&["x","y"])));}
    #[test]fn bounded_and_exact_dbscan_share_label_semantics_on_chain(){let ds=Dataset::new("chain",vec![Column::new("x",ColumnType::Numeric)],(0..20).map(|i|HashMap::from([("x".to_string(),Value::Number(i as f64))])).collect());let cloud=crate::data::neighbourhood::PointCloud::from_dataset(&ds,&["x".to_string()]).unwrap();let(exact,_)=crate::data::neighbourhood::ExactIndex.radius_neighbourhood(&cloud,1.1);let(bounded,_)=crate::data::neighbourhood::BoundedLandmarkIndex::new(3,20,4).radius_neighbourhood(&cloud,1.1);let a=dbscan_from_neighbourhood(&ds,1,&cloud,&exact,"[exact]");let b=dbscan_from_neighbourhood(&ds,1,&cloud,&bounded,"[bounded]");let labels_a:Vec<_>=a.rows.iter().map(|r|r.get("_cluster").cloned()).collect();let labels_b:Vec<_>=b.rows.iter().map(|r|r.get("_cluster").cloned()).collect();assert_eq!(labels_a,labels_b);}
}