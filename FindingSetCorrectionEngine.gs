/** Audited return of one never-approved Finding Set to Draft. */
var FQ_SET_RETURN_CONFIRMATION='RETURN FINDING SET TO DRAFT';
var FQ_SET_RETURN_REASON='Plain-language correction required before immutable Finding Set approval.';
var FQ_SET_RETURN_PREFIX='FQSETRETURN';
var FQ_SET_RETURN_FIELDS=['Previous Review Submitted By','Previous Review Submitted At','Returned By','Returned At','Return Reason','Return Operation Key'];

function returnSelectedFindingSetToDraftForCorrection(){
  const ui=SpreadsheetApp.getUi(),response=ui.prompt('Return Selected Finding Set to Draft for Correction','Type '+FQ_SET_RETURN_CONFIRMATION+' exactly.',ui.ButtonSet.OK_CANCEL);
  if(response.getSelectedButton()!==ui.Button.OK||response.getResponseText()!==FQ_SET_RETURN_CONFIRMATION)throw new Error('Finding Set return cancelled.');
  const result=returnFindingSetToDraftForCorrection_(requireSelectedFindingSetForReturn_(),{});
  ui.alert('Finding Set Returned',result.status==='already-completed'?'The audited return was already completed.':'The Finding Set is Draft and ready for correction.',ui.ButtonSet.OK);return result;
}
function requireSelectedFindingSetForReturn_(){
  const ss=SpreadsheetApp.getActiveSpreadsheet(),range=ss.getActiveRange(),sheet=range&&range.getSheet?range.getSheet():null;
  if(!sheet||sheet.getName()!==FQ_FINDING_SETS_SHEET||range.getNumRows()!==1||range.getRow()<=1)throw new Error('Select exactly one Finding Set data row.');
  const base=FQ_FINDING_SET_COLUMNS.filter(function(h){return FQ_SET_RETURN_FIELDS.indexOf(h)===-1;}),table=getHeaderTable_(sheet,base),record=findingQualityRecordFromValues_(sheet.getRange(range.getRow(),1,1,table.lastColumn).getValues()[0],table);
  if(!String(record['Finding Set ID']||'').trim()||!String(record.Version||'').trim())throw new Error('Selected Finding Set requires exact ID and version.');
  return{ss:ss,sheet:sheet,table:table,row:range.getRow(),record:record};
}
function returnFindingSetToDraftForCorrection_(selected,hooks){
  const lock=LockService.getDocumentLock();lock.waitLock(30000);
  try{
    const schema=getPreSnapshotRecoverySchema_(selected.ss),entry=schema[FQ_FINDING_SETS_SHEET],originalMax=entry.sheet.getMaxColumns(),createdColumns=Math.max(0,entry.requiredLastColumn-originalMax),installed=[];let before=null,set=null;
    try{
      if(createdColumns)entry.sheet.insertColumnsAfter(originalMax,createdColumns);if(hooks.afterCapacity)hooks.afterCapacity();
      entry.missingHeaders.forEach(function(h){entry.sheet.getRange(1,entry.table.headers[h]).setValue(h);installed.push(h);});if(hooks.afterHeaders)hooks.afterHeaders();
      const rows=readFindingQualityRecordsWithRows_(entry).filter(function(r){return String(r['Finding Set ID'])===String(selected.record['Finding Set ID'])&&String(r.Version)===String(selected.record.Version);});if(rows.length!==1)throw new Error('Selected Finding Set is missing or ambiguous.');
      set=rows[0];before=Object.assign({},set);delete before._row;
      if(String(set['Return Operation Key']||'')){assertReturnedFindingSet_(set,String(set['Return Operation Key']));return{status:'already-completed',operationKey:String(set['Return Operation Key'])};}
      if(String(set['Review Status'])!=='In Review'||String(set['Approval Status'])!=='In Review'||String(set['Document Eligibility'])!=='Not Eligible')throw new Error('Return requires one In Review / In Review / Not Eligible Finding Set.');
      if(String(set['Approved At']||set['Immutable Hash']||set['Snapshot File ID']||'').trim())throw new Error('Approved or snapshotted Finding Sets cannot return to Draft.');
      const bundle=loadFindingQualityApprovalBundle_(selected.ss,set);validateFindingSetSuccessorApprovalAuthority_(selected.ss,set,bundle);
      if(readFindingQualityRecords_(schema[FQ_ACTIONS_SHEET].sheet,schema[FQ_ACTIONS_SHEET].table).some(function(r){return String(r['Prospect ID'])===String(set['Prospect ID']);}))throw new Error('Return is blocked by an Action or downstream authority.');
      const key=FQ_SET_RETURN_PREFIX+':'+set['Finding Set ID']+':'+set.Version+':'+fingerprintFindingQualityValue_({by:set['Reviewed By'],at:findingQualityDateText_(set['Reviewed At']),reason:FQ_SET_RETURN_REASON}).slice(0,16),operator=String(requireHumanReviewer_()).trim().toLowerCase();
      const updated=Object.assign({},set,{'Review Status':'Draft','Approval Status':'Not Reviewed','Previous Review Submitted By':set['Reviewed By'],'Previous Review Submitted At':set['Reviewed At'],'Returned By':operator,'Returned At':new Date(),'Return Reason':FQ_SET_RETURN_REASON,'Return Operation Key':key,'Reviewed By':'','Reviewed At':''});delete updated._row;
      writeFindingQualityRecord_(entry.sheet,entry.table,set._row,updated);if(hooks.afterWrite)hooks.afterWrite();SpreadsheetApp.flush();assertReturnedFindingSet_(readFindingQualityRecord_(entry.sheet,entry.table,set._row),key);return{status:'completed',operationKey:key};
    }catch(error){
      try{if(before&&set)writeFindingQualityRecord_(entry.sheet,entry.table,set._row,before);installed.forEach(function(h){entry.sheet.getRange(1,entry.table.headers[h]).clearContent();});if(createdColumns&&entry.sheet.getMaxColumns()===originalMax+createdColumns)entry.sheet.deleteColumns(originalMax+1,createdColumns);SpreadsheetApp.flush();}catch(rollback){throw new Error(error.message+' Return rollback failed: '+rollback.message);}throw error;
    }
  }finally{lock.releaseLock();}
}
function assertReturnedFindingSet_(set,key){if(String(set['Review Status'])!=='Draft'||String(set['Approval Status'])!=='Not Reviewed'||String(set['Document Eligibility'])!=='Not Eligible'||String(set['Return Operation Key'])!==key||String(set['Return Reason'])!==FQ_SET_RETURN_REASON||!String(set['Previous Review Submitted By']||'')||!String(set['Previous Review Submitted At']||'')||!String(set['Returned By']||'')||!String(set['Returned At']||'')||String(set['Reviewed By']||set['Reviewed At']||''))throw new Error('Returned Finding Set readback is invalid.');}
