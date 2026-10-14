// Health extension only. Existing finance handlers are left unchanged except dispatch hooks.
// Generated deployment concatenates the shared, tested HealthModel before this file.
function healthPost_(body) {
  var action=body.action,props=PropertiesService.getScriptProperties();
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(15000))return _json({error:'health_busy'});
  try {
    if(action==='healthPairDevice') {
      var pairing=JSON.parse(props.getProperty('CMG_HEALTH_PAIR')||'null');
      if(!pairing || pairing.expiresAt<Date.now() || !/^[a-f0-9]{12}$/i.test(body.code||'') || _sha256Hex(String(body.code).toLowerCase())!==pairing.hash)
        return _json({error:'invalid_or_expired_pairing'});
      if(_allowedHashes().indexOf(pairing.owner)===-1)return _json({error:'unauthorized'});
      var token=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
      var id=Utilities.getUuid();
      props.setProperty('CMG_HEALTH_DEVICE_'+pairing.owner,JSON.stringify({id:id,tokenHash:_sha256Hex(token),owner:pairing.owner,createdAt:new Date().toISOString()}));
      props.deleteProperty('CMG_HEALTH_PAIR');
      return _json({ok:true,deviceId:id,deviceToken:token});
    }
    if(action==='healthUpload') {
      if(!/^[a-f0-9]{64}$/.test(body.deviceToken||''))return _json({error:'unauthorized_device'});
      var all=props.getProperties(),device=null,deviceKey=null;
      Object.keys(all).filter(function(k){return k.indexOf('CMG_HEALTH_DEVICE_')===0;}).some(function(k){
        var d=JSON.parse(all[k]);
        if(d.id===body.deviceId && d.tokenHash===_sha256Hex(body.deviceToken)){device=d;deviceKey=k;return true;}return false;
      });
      if(!device || _allowedHashes().indexOf(device.owner)===-1)return _json({error:'unauthorized_device'});
      var serialized=JSON.stringify(body.snapshot);
      if(!serialized || serialized.length>4000000)return _json({error:'health_payload_too_large'});
      if(Math.abs(Date.now()-Date.parse(body.snapshot.generatedAt))>2*86400000)return _json({error:'phone_clock_or_old_snapshot'});
      var existing=healthRead_(device.owner);
      var next=HealthModel.mergeHealth(existing,body.snapshot);
      if(next!==existing)healthWrite_(device.owner,JSON.stringify(next));
      device.lastSeen=new Date().toISOString();props.setProperty(deviceKey,JSON.stringify(device));
      return _json({ok:true,updatedAt:next.updatedAt,days:next.days.length});
    }
    var email=_verifySession(body.healthSession);
    if(!email)return _json({error:'unauthorized'});
    var owner=_sha256Hex(String(email).toLowerCase());
    if(action==='healthCreatePair') {
      var code=Utilities.getUuid().replace(/-/g,'').slice(0,12),expiresAt=Date.now()+10*60*1000;
      props.setProperty('CMG_HEALTH_PAIR',JSON.stringify({owner:owner,hash:_sha256Hex(code),expiresAt:expiresAt}));
      return _json({ok:true,code:code,expiresAt:expiresAt});
    }
    if(action==='healthRevokeDevice') {
      props.deleteProperty('CMG_HEALTH_DEVICE_'+owner);
      var pair=JSON.parse(props.getProperty('CMG_HEALTH_PAIR')||'null');
      if(pair && pair.owner===owner)props.deleteProperty('CMG_HEALTH_PAIR');
      return _json({ok:true});
    }
    if(action==='healthGet') {
      var data=healthRead_(owner);
      // Raw samples stay in private Drive, not sent to the browser dashboard.
      var deviceInfo=JSON.parse(props.getProperty('CMG_HEALTH_DEVICE_'+owner)||'null');
      if(deviceInfo){delete deviceInfo.tokenHash;delete deviceInfo.owner;}
      return _json({ok:true,data:{schemaVersion:1,updatedAt:data.updatedAt||null,timeZone:data.timeZone||null,days:data.days||[],warnings:data.warnings||[],availability:data.availability||[]},device:deviceInfo});
    }
    return _json({error:'unknown_health_action'});
  } catch(error) {
    // No tokens, health values, or request bodies in logs or error responses.
    return _json({error:'health_request_failed'});
  } finally {lock.releaseLock();}
}
function healthRead_(owner) {
  var id=PropertiesService.getScriptProperties().getProperty('CMG_HEALTH_FILE_'+owner);
  if(!id)return {schemaVersion:1,days:[]};
  var value=JSON.parse(DriveApp.getFileById(id).getBlob().getDataAsString());
  if(value.schemaVersion!==1 || !Array.isArray(value.days))throw new Error('invalid_health_store');
  return value;
}
function healthWrite_(owner,content) {
  var props=PropertiesService.getScriptProperties(),key='CMG_HEALTH_FILE_'+owner,id=props.getProperty(key);
  if(!id){
    var created=DriveApp.createFile('trackcmg_health_'+owner.slice(0,12)+'.json',content,'application/json');
    props.setProperty(key,created.getId());return;
  }
  var file=DriveApp.getFileById(id),backupKey='CMG_HEALTH_BACKUP_'+owner,backupId=props.getProperty(backupKey);
  // Keep the previous good health document in a separate PRIVATE file before replacing it.
  var before=file.getBlob().getDataAsString();
  if(backupId)DriveApp.getFileById(backupId).setContent(before);
  else props.setProperty(backupKey,DriveApp.createFile('trackcmg_health_previous_'+owner.slice(0,12)+'.json',before,'application/json').getId());
  file.setContent(content);
}
function testHealthSetup() {
  // Pure smoke test in the actual Apps Script runtime. No real health, files or device keys.
  var s={format:'trackcmg-health-probe',schemaVersion:1,timeZone:'Europe/Madrid',start:'2026-10-13T22:00:00Z',end:'2026-10-14T20:00:00Z',generatedAt:'2026-10-14T20:00:01Z',dailyAggregates:[],types:[{type:'oxygenSaturation',status:'ok',records:[{id:'synthetic-test',source:'com.example.test',time:'2026-10-14T10:00:00Z',value:98,unit:'%'}]}]};
  var result=HealthModel.mergeHealth(null,s);
  if(result.days.length!==1 || result.days[0].metrics.oxygenSaturation.value!==98)throw new Error('Health model smoke test failed');
  Logger.log('Health runtime OK: date/time zone, validation and daily transformation. No real data used or written.');
}
