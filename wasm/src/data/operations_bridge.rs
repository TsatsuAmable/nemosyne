//! Generic analytical operation request + dispatcher.
//!
//! `Operation` is the canonical serialisable analytical ABI. RF-029/RF-031/
//! RF-035 add a resource preflight to every mutation before the operation can
//! allocate its output or materialise that output to the host. Exact clustering
//! remains the default. DBSCAN may use an explicit, bounded landmark mode only
//! after exact execution is refused and deterministic sample validation passes.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::data::column::{Column, ColumnType};
use crate::data::dataset::Dataset;
use crate::data::neighbourhood::{
    validate_bounded_landmark_quality, ApproximationQualityEvidence, BoundedLandmarkIndex,
    PointCloud,
};
use crate::data::operations;
use crate::data::provenance;
use crate::data::resource_budget::{
    self, AnalysisBudget, AnalysisComplexity, ResourceDecision, ResourceEstimate,
};
use crate::data::value::Value;

const MAX_BOUNDED_LANDMARKS: usize = 256;
const MAX_BOUNDED_NEIGHBORS: usize = 64;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "lowercase")]
pub enum Predicate {
    Eq { column: String, value: serde_json::Value },
    Ne { column: String, value: serde_json::Value },
    Gt { column: String, value: f64 },
    Gte { column: String, value: f64 },
    Lt { column: String, value: f64 },
    Lte { column: String, value: f64 },
    In { column: String, values: Vec<serde_json::Value> },
    Between { column: String, lo: f64, hi: f64 },
    IsNull { column: String },
    And { children: Vec<Predicate> },
    Or { children: Vec<Predicate> },
    Not { child: Box<Predicate> },
}

impl Predicate {
    pub fn evaluate(&self, row: &HashMap<String, Value>) -> bool {
        match self {
            Predicate::Eq { column, value } => row.get(column).map(|v| *v == json_to_value(value)).unwrap_or(false),
            Predicate::Ne { column, value } => row.get(column).map(|v| *v != json_to_value(value)).unwrap_or(true),
            Predicate::Gt { column, value } => cmp_num(row, column, |n| n > *value),
            Predicate::Gte { column, value } => cmp_num(row, column, |n| n >= *value),
            Predicate::Lt { column, value } => cmp_num(row, column, |n| n < *value),
            Predicate::Lte { column, value } => cmp_num(row, column, |n| n <= *value),
            Predicate::In { column, values } => row.get(column).is_some_and(|v| values.iter().any(|j| *v == json_to_value(j))),
            Predicate::Between { column, lo, hi } => cmp_num(row, column, |n| n >= *lo && n <= *hi),
            Predicate::IsNull { column } => matches!(row.get(column), None | Some(Value::Null)),
            Predicate::And { children } => children.iter().all(|c| c.evaluate(row)),
            Predicate::Or { children } => children.iter().any(|c| c.evaluate(row)),
            Predicate::Not { child } => !child.evaluate(row),
        }
    }
}

fn cmp_num(row: &HashMap<String, Value>, column: &str, pred: impl Fn(f64) -> bool) -> bool {
    row.get(column).and_then(|v| v.as_number()).filter(|n| n.is_finite()).map(pred).unwrap_or(false)
}

fn json_to_value(v: &serde_json::Value) -> Value {
    match v {
        serde_json::Value::Null => Value::Null,
        serde_json::Value::Bool(b) => Value::Bool(*b),
        serde_json::Value::Number(n) => Value::Number(n.as_f64().unwrap_or(0.0)),
        serde_json::Value::String(s) => Value::Text(s.clone()),
        other => Value::Text(other.to_string()),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AggregatorFn { Sum, Mean, Median, Min, Max, Count, Std, Var }
impl AggregatorFn {
    fn as_str(self) -> &'static str {
        match self { Self::Sum=>"sum",Self::Mean=>"mean",Self::Median=>"median",Self::Min=>"min",Self::Max=>"max",Self::Count=>"count",Self::Std=>"std",Self::Var=>"var" }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Aggregator {
    pub column: String,
    pub function: AggregatorFn,
    #[serde(default, rename = "as")]
    pub as_name: Option<String>,
}
impl Aggregator { fn output_name(&self)->String{self.as_name.clone().unwrap_or_else(||format!("{}_{}",self.column,self.function.as_str()))} }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "mode", rename_all = "snake_case")]
pub enum ApproximationRequest {
    BoundedLandmark {
        #[serde(default = "default_approximation_seed")]
        seed: u32,
        #[serde(rename = "landmarkCount")]
        landmark_count: usize,
        #[serde(rename = "maxNeighbors")]
        max_neighbors: usize,
    },
}
fn default_approximation_seed() -> u32 { 42 }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum Operation {
    Filter { #[serde(default)] predicate: Option<Predicate>, #[serde(default)] column: Option<String>, #[serde(default)] min: Option<f64>, #[serde(default)] max: Option<f64> },
    Sort { column: String, #[serde(default = "default_ascending")] ascending: bool },
    Aggregate { #[serde(default)] group_by: Option<String>, #[serde(default)] group_by_columns: Option<Vec<String>>, #[serde(default)] aggregators: Option<Vec<Aggregator>> },
    Compare { group_by: String, group_a: String, group_b: String, #[serde(default)] measures: Option<Vec<String>> },
    Slice { start: usize, end: usize },
    #[serde(rename = "anomaly_iqr")]
    AnomalyIqr { column: String, #[serde(default = "default_sensitivity")] sensitivity: f64 },
    #[serde(rename = "anomaly_zscore")]
    AnomalyZscore { column: String, #[serde(default)] sensitivity: Option<f64> },
    KMeans { k: usize, #[serde(default)] features: Option<Vec<String>> },
    Hierarchical { k: usize, #[serde(default = "default_linkage")] linkage: String, #[serde(default)] features: Option<Vec<String>> },
    Dbscan { eps: f64, min_points: usize, #[serde(default)] features: Option<Vec<String>>, #[serde(default)] approximation: Option<ApproximationRequest> },
}

fn default_ascending()->bool{true} fn default_sensitivity()->f64{1.5} fn default_linkage()->String{"average".to_string()}

impl Operation {
    fn name(&self) -> &'static str {
        match self {
            Self::Filter { .. } => "filter", Self::Sort { .. } => "sort", Self::Aggregate { .. } => "aggregate",
            Self::Compare { .. } => "compare", Self::Slice { .. } => "slice", Self::AnomalyIqr { .. } => "anomaly_iqr",
            Self::AnomalyZscore { .. } => "anomaly_zscore", Self::KMeans { .. } => "k_means",
            Self::Hierarchical { .. } => "hierarchical", Self::Dbscan { .. } => "dbscan",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationResourcePreflight {
    pub source_rows: usize,
    pub output_rows_upper_bound: usize,
    pub output_columns_upper_bound: usize,
    pub dimensions: usize,
    pub estimate: ResourceEstimate,
    pub refusal: Option<String>,
}

fn metric_dimensions(dataset:&Dataset,features:Option<&[String]>)->usize{features.map_or_else(||dataset.numeric_columns().len(),|names|names.len())}

fn output_shape(dataset: &Dataset, op: &Operation) -> (usize, usize) {
    let rows = dataset.row_count(); let columns = dataset.columns.len();
    match op {
        Operation::Filter { .. } | Operation::Sort { .. } => (rows, columns),
        Operation::Aggregate { group_by, group_by_columns, aggregators } => {
            let group_columns = group_by_columns.as_ref().filter(|v|!v.is_empty()).map_or_else(||usize::from(group_by.is_some()),Vec::len);
            let output_columns = aggregators.as_ref().filter(|v|!v.is_empty()).map_or(columns, |v| group_columns.saturating_add(v.len()));
            (rows, output_columns.max(1))
        }
        Operation::Compare { measures, .. } => (measures.as_ref().filter(|v|!v.is_empty()).map_or(columns,Vec::len), 9),
        Operation::Slice { start, end } => (end.saturating_sub(*start).min(rows), columns),
        Operation::AnomalyIqr { .. } | Operation::AnomalyZscore { .. } => (rows, columns.saturating_add(2)),
        Operation::KMeans { .. } | Operation::Hierarchical { .. } | Operation::Dbscan { .. } => (rows, columns.saturating_add(1)),
    }
}

fn simple_estimate(dataset:&Dataset,op:&Operation,rows_out:usize,columns_out:usize,budget:AnalysisBudget)->ResourceEstimate{
    let rows=dataset.row_count();let dims=dataset.columns.len().max(1);
    let (complexity,work)=match op{
        Operation::Sort{..}=>(AnalysisComplexity::NLogN,(rows as u64).saturating_mul(64)),
        Operation::AnomalyIqr{..}=>(AnalysisComplexity::NLogN,(rows as u64).saturating_mul(64)),
        _=>(AnalysisComplexity::Linear,(rows as u64).saturating_mul(dims as u64)),
    };
    let transient=resource_budget::row_dataset_bytes(rows_out,columns_out);
    let (decision,reason_code)=if transient>budget.max_transient_bytes{(ResourceDecision::UnsupportedAtScale,Some("TRANSIENT_MEMORY_BUDGET_EXCEEDED".to_string()))}
        else if work>budget.max_exact_work_units{(ResourceDecision::UnsupportedAtScale,Some("EXACT_WORK_BUDGET_EXCEEDED".to_string()))}
        else{(ResourceDecision::ExactAllowed,None)};
    ResourceEstimate{operation:op.name().to_string(),rows,dimensions:dims,complexity,estimated_work_units:work,estimated_transient_bytes:transient,estimated_resident_bytes:0,estimated_transfer_bytes:0,estimated_peak_bytes:transient,decision,reason_code}
}

fn build_exact_preflight(dataset:&Dataset,op:&Operation)->OperationResourcePreflight{
    let budget=AnalysisBudget::default();let(rows_out,columns_out)=output_shape(dataset,op);let transfer=resource_budget::dataset_materialization_bytes(rows_out,columns_out);let resident=resource_budget::resident_dataset_bytes(dataset.row_count(),dataset.columns.len(),true);
    let dimensions=match op{Operation::KMeans{features,..}|Operation::Hierarchical{features,..}|Operation::Dbscan{features,..}=>metric_dimensions(dataset,features.as_deref()),_=>dataset.columns.len()};
    let base=match op{
        Operation::KMeans{k,..}=>resource_budget::kmeans_estimate(dataset.row_count(),dimensions,*k,budget),
        Operation::Hierarchical{..}=>resource_budget::hierarchical_estimate(dataset.row_count(),dimensions,budget),
        Operation::Dbscan{..}=>resource_budget::exact_neighbourhood_estimate(dataset.row_count(),dimensions,budget).with_operation("dbscan"),
        _=>simple_estimate(dataset,op,rows_out,columns_out,budget),
    };
    let estimate=base.with_memory_envelope(resident,transfer,budget);
    let refusal=resource_budget::require_exact(&estimate).err();
    OperationResourcePreflight{source_rows:dataset.row_count(),output_rows_upper_bound:rows_out,output_columns_upper_bound:columns_out,dimensions,estimate,refusal}
}

fn build_bounded_dbscan_preflight(dataset:&Dataset,features:Option<&[String]>,landmark_count:usize,max_neighbors:usize)->OperationResourcePreflight{
    let budget=AnalysisBudget::default();let dimensions=metric_dimensions(dataset,features);let rows_out=dataset.row_count();let columns_out=dataset.columns.len().saturating_add(1);
    let transfer=resource_budget::dataset_materialization_bytes(rows_out,columns_out);let resident=resource_budget::resident_dataset_bytes(dataset.row_count(),dataset.columns.len(),true);
    let mut estimate=resource_budget::bounded_landmark_estimate(dataset.row_count(),dimensions,landmark_count,max_neighbors,budget).with_operation("dbscan").with_memory_envelope(resident,transfer,budget);
    if landmark_count==0||landmark_count>MAX_BOUNDED_LANDMARKS||max_neighbors==0||max_neighbors>MAX_BOUNDED_NEIGHBORS{
        estimate.decision=ResourceDecision::UnsupportedAtScale;estimate.reason_code=Some("BOUNDED_APPROXIMATION_PARAMETER_LIMIT_EXCEEDED".to_string());
    }
    let refusal=resource_budget::require_bounded_approximation(&estimate).err();
    OperationResourcePreflight{source_rows:dataset.row_count(),output_rows_upper_bound:rows_out,output_columns_upper_bound:columns_out,dimensions,estimate,refusal}
}

fn params_with_preflight(op:&Operation,preflight:&OperationResourcePreflight)->serde_json::Value{
    let mut params=serde_json::to_value(op).unwrap_or(serde_json::Value::Null);
    if let serde_json::Value::Object(map)=&mut params{map.insert("resourcePreflight".to_string(),serde_json::to_value(preflight).unwrap_or(serde_json::Value::Null));}
    params
}

fn refuse(dataset:&Dataset,op:&Operation,preflight:&OperationResourcePreflight)->Result<Dataset,String>{
    provenance::record_refusal(op.name(),params_with_preflight(op,preflight),&dataset.fingerprint());
    Err(preflight.refusal.clone().unwrap_or_else(||format!("UNSUPPORTED_AT_SCALE:operation={}",op.name())))
}

fn publish_exact_evidence(preflight:&OperationResourcePreflight){provenance::set_pending_operation_evidence(serde_json::json!({"executionMode":"exact","preflight":preflight}));}
fn publish_bounded_evidence(preflight:&OperationResourcePreflight,request:&ApproximationRequest,quality:&ApproximationQualityEvidence){provenance::set_pending_operation_evidence(serde_json::json!({"executionMode":"bounded_approximation","preflight":preflight,"approximation":request,"quality":quality}));}

pub fn apply(dataset:&Dataset,op:Operation)->Result<Dataset,String>{
    provenance::clear_pending_operation_evidence();
    let exact_preflight=build_exact_preflight(dataset,&op);

    // DBSCAN is the first governed bounded alternative. It is never silently
    // selected: exact wins when admitted; only an explicit request may replace a
    // refused exact neighbourhood, and that approximation must pass its quality gate.
    if let Operation::Dbscan{eps,min_points,features,approximation}=op.clone(){
        if exact_preflight.refusal.is_none(){publish_exact_evidence(&exact_preflight);let feature_refs:Option<Vec<&str>>=features.as_ref().map(|v|v.iter().map(String::as_str).collect());return Ok(operations::dbscan(dataset,eps,min_points,feature_refs.as_deref()));}
        let Some(request)=approximation else{return refuse(dataset,&op,&exact_preflight);};
        let ApproximationRequest::BoundedLandmark{seed,landmark_count,max_neighbors}=request.clone();
        let bounded_preflight=build_bounded_dbscan_preflight(dataset,features.as_deref(),landmark_count,max_neighbors);
        if bounded_preflight.refusal.is_some(){return refuse(dataset,&op,&bounded_preflight);}
        let numeric_names:Vec<String>=features.clone().unwrap_or_else(||dataset.numeric_columns().into_iter().map(|c|c.name.clone()).collect());
        let cloud=PointCloud::from_dataset(dataset,&numeric_names).map_err(|e|e.to_string())?;
        let quality=validate_bounded_landmark_quality(&cloud,eps,seed,landmark_count,max_neighbors);
        if !quality.passed{
            let mut failed=bounded_preflight.clone();failed.estimate.decision=ResourceDecision::UnsupportedAtScale;failed.estimate.reason_code=Some("APPROXIMATION_QUALITY_GATE_FAILED".to_string());failed.refusal=resource_budget::require_exact(&failed.estimate).err();return refuse(dataset,&op,&failed);
        }
        let(csr,_)=BoundedLandmarkIndex::new(seed,landmark_count,max_neighbors).radius_neighbourhood(&cloud,eps);
        publish_bounded_evidence(&bounded_preflight,&request,&quality);
        return Ok(operations::dbscan_from_neighbourhood(dataset,min_points,&cloud,&csr,"[dbscan:bounded_landmark]"));
    }

    if exact_preflight.refusal.is_some(){return refuse(dataset,&op,&exact_preflight);}
    publish_exact_evidence(&exact_preflight);
    match op{
        Operation::Filter{predicate,column,min,max}=>{let pred=if let Some(p)=predicate{p}else if let Some(col)=column{legacy_range_predicate(col,min,max)}else{return Err("filter requires `predicate` or `column`".to_string());};Ok(operations::filter(dataset,|row|pred.evaluate(row)))}
        Operation::Sort{column,ascending}=>Ok(operations::sort(dataset,&column,ascending)),
        Operation::Aggregate{group_by,group_by_columns,aggregators}=>{let group_keys:Vec<String>=match group_by_columns{Some(cols)if!cols.is_empty()=>cols,Some(_)=>group_by.into_iter().collect(),None=>group_by.into_iter().collect()};if group_keys.is_empty(){return Err("aggregate requires `group_by` or `group_by_columns`".to_string());}match aggregators{Some(aggs)if!aggs.is_empty()=>apply_aggregate(dataset,&group_keys,&aggs),_=>{let single=group_keys.join(",");Ok(operations::aggregate(dataset,&group_keys[0],|group|operations::default_sum_aggregator(&group_keys[0],group)).map_name(&format!("[aggregated by {}]",single)))}}}
        Operation::Compare{group_by,group_a,group_b,measures}=>apply_compare(dataset,&group_by,&group_a,&group_b,measures),
        Operation::Slice{start,end}=>Ok(operations::slice(dataset,start,end)),
        Operation::AnomalyIqr{column,sensitivity}=>Ok(operations::anomaly_iqr(dataset,&column,sensitivity)),
        Operation::AnomalyZscore{column,sensitivity}=>Ok(anomaly_zscore(dataset,&column,sensitivity)),
        Operation::KMeans{k,features}=>{let refs:Option<Vec<&str>>=features.as_ref().map(|v|v.iter().map(String::as_str).collect());Ok(operations::k_means(dataset,k,refs.as_deref()))}
        Operation::Hierarchical{k,linkage,features}=>{let refs:Option<Vec<&str>>=features.as_ref().map(|v|v.iter().map(String::as_str).collect());Ok(operations::hierarchical(dataset,refs.as_deref(),&linkage,k))}
        Operation::Dbscan{..}=>unreachable!("DBSCAN handled above"),
    }
}

fn legacy_range_predicate(column:String,min:Option<f64>,max:Option<f64>)->Predicate{let mut children=Vec::new();if let Some(lo)=min{children.push(Predicate::Gte{column:column.clone(),value:lo});}if let Some(hi)=max{children.push(Predicate::Lte{column:column.clone(),value:hi});}match children.len(){0=>Predicate::In{column,values:Vec::new()},1=>children.into_iter().next().unwrap(),_=>Predicate::And{children}}}

fn apply_aggregate(dataset:&Dataset,group_keys:&[String],aggregators:&[Aggregator])->Result<Dataset,String>{use std::collections::BTreeMap;let mut groups:BTreeMap<String,(Vec<Value>,Vec<&HashMap<String,Value>>)>=BTreeMap::new();for row in &dataset.rows{let key_vals:Vec<Value>=group_keys.iter().map(|k|row.get(k).cloned().unwrap_or(Value::Null)).collect();let composite=key_vals.iter().map(|v|v.to_key_string()).collect::<Vec<_>>().join("\u{1f}");groups.entry(composite).or_insert_with(||(key_vals.clone(),Vec::new())).1.push(row);}let mut out_columns=Vec::new();for k in group_keys{out_columns.push(dataset.get_column(k).cloned().unwrap_or_else(||Column::new(k.clone(),ColumnType::Unknown)));}for agg in aggregators{out_columns.push(Column::new(agg.output_name(),ColumnType::Numeric));}let mut out_rows=Vec::new();for(_, (key_vals,rows))in &groups{let mut r=HashMap::new();for(k,v)in group_keys.iter().zip(key_vals.iter()){r.insert(k.clone(),v.clone());}for agg in aggregators{let vals:Vec<f64>=rows.iter().filter_map(|row|row.get(&agg.column).and_then(|v|v.as_number())).filter(|n|n.is_finite()).collect();let result=if matches!(agg.function,AggregatorFn::Count){rows.iter().filter(|row|!matches!(row.get(&agg.column),None|Some(Value::Null))).count() as f64}else{compute_aggregate(agg.function,&vals)};r.insert(agg.output_name(),Value::Number(result));}out_rows.push(r);}let mut result=dataset.clone_with_rows(out_rows,&format!("[aggregated by {}]",group_keys.join(",")));result.columns=out_columns;Ok(result)}

fn compute_aggregate(function:AggregatorFn,vals:&[f64])->f64{if vals.is_empty(){return 0.0;}let n=vals.len();match function{AggregatorFn::Sum=>vals.iter().sum(),AggregatorFn::Mean=>vals.iter().sum::<f64>()/n as f64,AggregatorFn::Median=>{let mut s=vals.to_vec();s.sort_by(|a,b|a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));if n%2==0{(s[n/2-1]+s[n/2])/2.0}else{s[n/2]}},AggregatorFn::Min=>vals.iter().copied().fold(f64::INFINITY,f64::min),AggregatorFn::Max=>vals.iter().copied().fold(f64::NEG_INFINITY,f64::max),AggregatorFn::Count=>n as f64,AggregatorFn::Var=>{let mean=vals.iter().sum::<f64>()/n as f64;vals.iter().map(|v|(v-mean).powi(2)).sum::<f64>()/n as f64},AggregatorFn::Std=>{let mean=vals.iter().sum::<f64>()/n as f64;let var=vals.iter().map(|v|(v-mean).powi(2)).sum::<f64>()/n as f64;var.sqrt()}}}

fn apply_compare(dataset:&Dataset,group_by:&str,group_a:&str,group_b:&str,measures:Option<Vec<String>>)->Result<Dataset,String>{let measure_cols:Vec<String>=match measures{Some(m)if!m.is_empty()=>m,_=>dataset.numeric_columns().iter().map(|c|c.name.clone()).filter(|n|n!=group_by).collect()};let mut rows_a=Vec::new();let mut rows_b=Vec::new();for row in &dataset.rows{let key=row.get(group_by).map(|v|v.to_key_string()).unwrap_or_default();if key==group_a{rows_a.push(row);}else if key==group_b{rows_b.push(row);}}let columns=vec![Column::new(group_by.to_string(),ColumnType::Categorical),Column::new("_measure",ColumnType::Text),Column::new("_groupA",ColumnType::Categorical),Column::new("_groupB",ColumnType::Categorical),Column::new("_meanA",ColumnType::Numeric),Column::new("_meanB",ColumnType::Numeric),Column::new("_difference",ColumnType::Numeric),Column::new("_countA",ColumnType::Numeric),Column::new("_countB",ColumnType::Numeric)];let mut out_rows=Vec::new();for measure in &measure_cols{let vals_a:Vec<f64>=rows_a.iter().filter_map(|r|r.get(measure).and_then(|v|v.as_number())).filter(|n|n.is_finite()).collect();let vals_b:Vec<f64>=rows_b.iter().filter_map(|r|r.get(measure).and_then(|v|v.as_number())).filter(|n|n.is_finite()).collect();let mean_a=mean_of(&vals_a);let mean_b=mean_of(&vals_b);let difference=match(mean_a,mean_b){(Some(a),Some(b))=>Some(a-b),_=>None};let mut r=HashMap::new();r.insert(group_by.to_string(),Value::Text(format!("{} vs {}",group_a,group_b)));r.insert("_measure".to_string(),Value::Text(measure.clone()));r.insert("_groupA".to_string(),Value::Text(group_a.to_string()));r.insert("_groupB".to_string(),Value::Text(group_b.to_string()));r.insert("_meanA".to_string(),num_or_null(mean_a));r.insert("_meanB".to_string(),num_or_null(mean_b));r.insert("_difference".to_string(),num_or_null(difference));r.insert("_countA".to_string(),Value::Number(vals_a.len() as f64));r.insert("_countB".to_string(),Value::Number(vals_b.len() as f64));out_rows.push(r);}let mut result=dataset.clone_with_rows(out_rows,&format!("[compare {} vs {}]",group_a,group_b));result.columns=columns;Ok(result)}
fn mean_of(vals:&[f64])->Option<f64>{if vals.is_empty(){None}else{Some(vals.iter().sum::<f64>()/vals.len() as f64)}} fn num_or_null(opt:Option<f64>)->Value{opt.map(Value::Number).unwrap_or(Value::Null)}

fn anomaly_zscore(dataset:&Dataset,column_name:&str,threshold:Option<f64>)->Dataset{let threshold=threshold.unwrap_or(3.0);let values:Vec<f64>=dataset.get_column_values(column_name).into_iter().flatten().filter_map(|v|v.as_number()).filter(|n|n.is_finite()).collect();let(mean,std)=if values.is_empty(){(0.0,0.0)}else{let mean=values.iter().sum::<f64>()/values.len() as f64;let var=values.iter().map(|v|(v-mean).powi(2)).sum::<f64>()/values.len() as f64;(mean,var.sqrt())};let mut rows=dataset.rows.clone();for row in &mut rows{let(score,flag)=if std>0.0{if let Some(v)=row.get(column_name).and_then(|v|v.as_number()).filter(|n|n.is_finite()){let z=(v-mean)/std;(z,z.abs()>threshold)}else{(0.0,false)}}else{(0.0,false)};row.insert("_anomaly".to_string(),Value::Bool(flag));row.insert("_anomalyScore".to_string(),Value::Number(score));}let mut columns=dataset.columns.clone();ensure_column(&mut columns,"_anomaly",ColumnType::Categorical);ensure_column(&mut columns,"_anomalyScore",ColumnType::Numeric);let mut result=dataset.clone_with_rows(rows,"[anomaly:zscore]");result.columns=columns;result}
fn ensure_column(columns:&mut Vec<Column>,name:&str,ty:ColumnType){if !columns.iter().any(|c|c.name==name){columns.push(Column::new(name,ty));}}
trait DatasetNameExt{fn map_name(self,suffix:&str)->Self;}impl DatasetNameExt for Dataset{fn map_name(mut self,suffix:&str)->Self{self.name=format!("{} {}",self.name,suffix);self}}

#[cfg(test)]
mod tests{
    use super::*;use crate::data::column::ColumnType;
    fn sample()->Dataset{let columns=vec![Column::new("name",ColumnType::Categorical),Column::new("age",ColumnType::Numeric),Column::new("team",ColumnType::Categorical)];let rows=vec![row([("name","Alice"),("age","30"),("team","A")]),row([("name","Bob"),("age","25"),("team","B")]),row([("name","Carol"),("age","40"),("team","A")]),row([("name","Dave"),("age","35"),("team","B")])];Dataset::new("people",columns,rows)}
    fn row(pairs:[(&str,&str);3])->HashMap<String,Value>{let mut r=HashMap::new();for(k,v)in pairs{if let Ok(n)=v.parse::<f64>(){r.insert(k.to_string(),Value::Number(n));}else{r.insert(k.to_string(),Value::Text(v.to_string()));}}r}
    fn numeric_dataset(row_count:usize,dimensions:usize)->Dataset{let columns=(0..dimensions).map(|d|Column::new(format!("x{d}"),ColumnType::Numeric)).collect();let rows=(0..row_count).map(|r|(0..dimensions).map(|d|(format!("x{d}"),Value::Number((r+d)as f64))).collect()).collect();Dataset::new("scale-fixture",columns,rows)}
    #[test]fn predicate_dsl_eq_and_between(){let parsed:Operation=serde_json::from_str(r#"{"op":"filter","predicate":{"op":"and","children":[{"op":"eq","column":"team","value":"A"},{"op":"gte","column":"age","value":35}]}}"#).unwrap();let result=apply(&sample(),parsed).unwrap();assert_eq!(result.row_count(),1);assert_eq!(result.rows[0].get("name").and_then(|v|v.as_text()),Some("Carol"));}
    #[test]fn predicate_dsl_in_and_not(){let parsed:Operation=serde_json::from_str(r#"{"op":"filter","predicate":{"op":"not","child":{"op":"in","column":"team","values":["A","B"]}}}"#).unwrap();assert_eq!(apply(&sample(),parsed).unwrap().row_count(),0);}
    #[test]fn legacy_range_filter_still_works(){let parsed:Operation=serde_json::from_str(r#"{"op":"filter","column":"age","min":30}"#).unwrap();assert_eq!(apply(&sample(),parsed).unwrap().row_count(),3);}
    #[test]fn aggregate_named_aggregators(){let parsed:Operation=serde_json::from_str(r#"{"op":"aggregate","group_by":"team","aggregators":[{"column":"age","function":"mean","as":"avgAge"},{"column":"age","function":"max","as":"maxAge"},{"column":"name","function":"count","as":"n"}]}"#).unwrap();let result=apply(&sample(),parsed).unwrap();assert_eq!(result.row_count(),2);let a=result.rows.iter().find(|r|r.get("team").and_then(|v|v.as_text())==Some("A")).unwrap();assert_eq!(a.get("avgAge").and_then(|v|v.as_number()),Some(35.0));assert_eq!(a.get("maxAge").and_then(|v|v.as_number()),Some(40.0));assert_eq!(a.get("n").and_then(|v|v.as_number()),Some(2.0));}
    #[test]fn aggregate_legacy_sum_all_numeric(){let parsed:Operation=serde_json::from_str(r#"{"op":"aggregate","group_by":"team"}"#).unwrap();let result=apply(&sample(),parsed).unwrap();let a=result.rows.iter().find(|r|r.get("team").and_then(|v|v.as_text())==Some("A")).unwrap();assert_eq!(a.get("age").and_then(|v|v.as_number()),Some(70.0));}
    #[test]fn compare_two_groups(){let parsed:Operation=serde_json::from_str(r#"{"op":"compare","group_by":"team","group_a":"A","group_b":"B","measures":["age"]}"#).unwrap();let result=apply(&sample(),parsed).unwrap();assert_eq!(result.rows[0].get("_difference").and_then(|v|v.as_number()),Some(5.0));}
    #[test]fn anomaly_zscore_flags_outlier(){let ds=Dataset::new("z",vec![Column::new("v",ColumnType::Numeric)],vec![row_num("v",30.0),row_num("v",30.0),row_num("v",30.0),row_num("v",1000.0)]);let parsed:Operation=serde_json::from_str(r#"{"op":"anomaly_zscore","column":"v","sensitivity":1.5}"#).unwrap();let result=apply(&ds,parsed).unwrap();let flags:Vec<bool>=result.rows.iter().map(|r|matches!(r.get("_anomaly"),Some(Value::Bool(true)))).collect();assert_eq!(flags,vec![false,false,false,true]);}
    fn row_num(col:&str,n:f64)->HashMap<String,Value>{HashMap::from([(col.to_string(),Value::Number(n))])}
    #[test]fn anomaly_iqr_op_name_matches_types(){let parsed:Operation=serde_json::from_str(r#"{"op":"anomaly_iqr","column":"age"}"#).unwrap();assert!(apply(&sample(),parsed).unwrap().get_column("_anomaly").is_some());}
    #[test]fn scale_preflight_rejects_pathological_hierarchical_work(){let ds=numeric_dataset(500,2);let parsed:Operation=serde_json::from_str(r#"{"op":"hierarchical","k":2,"linkage":"average"}"#).unwrap();let error=apply(&ds,parsed).unwrap_err();assert!(error.starts_with("UNSUPPORTED_AT_SCALE:"));assert!(error.contains("hierarchical_clustering"));}
    #[test]fn scale_preflight_rejects_dbscan_dense_csr_hazard(){let ds=numeric_dataset(5_000,1);let parsed:Operation=serde_json::from_str(r#"{"op":"dbscan","eps":1.0,"min_points":3}"#).unwrap();let error=apply(&ds,parsed).unwrap_err();assert!(error.starts_with("UNSUPPORTED_AT_SCALE:"));}
    #[test]fn scale_preflight_rejects_kmeans_work_before_matrix_allocation(){let ds=numeric_dataset(5_000,16);let parsed:Operation=serde_json::from_str(r#"{"op":"k_means","k":32}"#).unwrap();let error=apply(&ds,parsed).unwrap_err();assert!(error.contains("EXACT_WORK_BUDGET_EXCEEDED"));}
    #[test]fn scale_preflight_preserves_small_clustering_operations(){let ds=numeric_dataset(20,2);for spec in [r#"{"op":"k_means","k":2}"#,r#"{"op":"hierarchical","k":2,"linkage":"average"}"#,r#"{"op":"dbscan","eps":2.0,"min_points":1}"#]{let parsed:Operation=serde_json::from_str(spec).unwrap();assert!(apply(&ds,parsed).is_ok(),"{spec}");}}
    #[test]fn rf035_large_mutation_refuses_before_unbounded_materialisation(){let ds=numeric_dataset(1_000_000,4);let parsed:Operation=serde_json::from_str(r#"{"op":"filter","column":"x0","min":0}"#).unwrap();let error=apply(&ds,parsed).unwrap_err();assert!(error.contains("MATERIALIZATION_BUDGET_EXCEEDED")||error.contains("PEAK_MEMORY_BUDGET_EXCEEDED")||error.contains("TRANSIENT_MEMORY_BUDGET_EXCEEDED"));let p:serde_json::Value=serde_json::from_str(&provenance::last_json()).unwrap();assert_eq!(p["outcome"],"refused");assert!(p["parameters"]["resourcePreflight"]["estimate"]["estimatedTransferBytes"].as_u64().unwrap()>0);}
    #[test]fn exact_success_publishes_resource_evidence_for_provenance(){provenance::clear();let ds=numeric_dataset(20,2);let parsed:Operation=serde_json::from_str(r#"{"op":"sort","column":"x0"}"#).unwrap();let result=apply(&ds,parsed).unwrap();provenance::record("sort",serde_json::json!({"column":"x0"}),&ds.fingerprint(),&result.fingerprint());let p:serde_json::Value=serde_json::from_str(&provenance::last_json()).unwrap();assert_eq!(p["parameters"]["resourceEvidence"]["executionMode"],"exact");assert!(p["parameters"]["resourceEvidence"]["preflight"]["estimate"]["estimatedPeakBytes"].as_u64().unwrap()>0);}
    #[test]fn bounded_dbscan_requires_explicit_opt_in_and_records_quality(){provenance::clear();let ds=numeric_dataset(200,1);let exact:Operation=serde_json::from_str(r#"{"op":"dbscan","eps":1.1,"min_points":1}"#).unwrap();assert!(apply(&ds,exact).is_err());let bounded:Operation=serde_json::from_str(r#"{"op":"dbscan","eps":1.1,"min_points":1,"approximation":{"mode":"bounded_landmark","seed":7,"landmarkCount":200,"maxNeighbors":4}}"#).unwrap();let result=apply(&ds,bounded).unwrap();provenance::record("dbscan",serde_json::json!({"approximation":{"mode":"bounded_landmark"}}),&ds.fingerprint(),&result.fingerprint());let p:serde_json::Value=serde_json::from_str(&provenance::last_json()).unwrap();assert_eq!(p["parameters"]["resourceEvidence"]["executionMode"],"bounded_approximation");assert_eq!(p["parameters"]["resourceEvidence"]["quality"]["passed"],true);}
}