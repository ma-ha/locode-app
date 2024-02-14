/* LOWCODE-DATA-APP / copyright 2024 by ma-ha https://github.com/ma-ha  /  MIT License */

const log        = require( '../helper/log' ).logger
const apiSec     = require( './api-sec' )
const dta        = require( '../persistence/app-dta' )
const userDta    = require( '../persistence/app-dta-user' )
const fileupload = require( 'express-fileupload' )

exports: module.exports = { 
  setupAPI
}

// ============================================================================
// API:
// now we need to implement the ReST service for /products 
// this should also only be available for authenticated users
let gui = null

async function setupAPI( app ) {
  let svc = app.getExpress()
  gui = app

  const guiAuthz = apiSec.userTenantAuthz( gui )

  // --------------------------------------------------------------------------
  svc.post( '/scope', addScope )
  svc.get(  '/scope', getScope )
  svc.get(  '/scope/options', getScopeOpts )
  svc.get(  '/scope/pong-table', getScopeTbl )

  svc.get(  '/app-lnk/html', guiAuthz, getAppLnk ) // for HTML view above the app list
  svc.get(  '/app', guiAuthz, getApp )
  svc.post( '/app', guiAuthz, addApp )
  svc.get(  '/app/customize', guiAuthz, getAppForCustomize )
  svc.get(  '/app/json/:scope/:id', guiAuthz, getAppJSON )
  svc.post( '/app/json', fileupload(),guiAuthz, uploadAppJSON )
  svc.get(  '/app/json/html', guiAuthz, getUploadAppResult )

  svc.get(    '/app/entity', guiAuthz, getEntity )
  svc.post(   '/app/entity', guiAuthz, addEntity )
  svc.delete( '/app/entity', guiAuthz, delEntity )

  svc.get(    '/app/entity/property', guiAuthz, getProperty )
  svc.post(   '/app/entity/property',  guiAuthz, addProperty )
  svc.delete( '/app/entity/property', guiAuthz, delProperty )

  svc.get(  '/erm', getERM )
  svc.post( '/erm', saveERM )
}
// ============================================================================

async function getAppLnk( req, res )  {
  log.info( 'GET erm' )
  let user = await userDta.getUserInfoFromReq( gui, req )
  if ( ! user ) { return res.status(401).send( 'login required' ) }
  res.send( '<a href="index.html?layout=ERM-nonav" class="erm-link">Show Data Model</a>')
}

async function getERM( req, res )  {
  log.info( 'GET erm' )
  let user = await userDta.getUserInfoFromReq( gui, req )
  if ( ! user ) { return res.status(401).send( 'login required' ) }
  let appId = req.query.id
  if ( appId ) {
    let app = await dta.getAppById( appId )
    res.send( app )
  } else {
    let ermCfg = await dta.getDataById( 'erm', user.scopeId )
    if ( ! ermCfg ) { ermCfg = {} }
    let appMap = await dta.getAppList( user.scopeId, [], 'admin' )
    let erm = {
      entity: {}
    }
    let x = 100
    let y = 100
    let i = 0 
    let cols = [ 'k8s-bg-blue','k8s-bg-lblue', 'k8s-bg-gray','k8s-bg-tk', 'k8s-bg-redgr', 'k8s-bg-lblue2', 'k8s-bg-lblue3' ]
    for ( let appId in appMap ) { try {
      let app = appMap[ appId ]
      for ( let entityId in app.entity ) {
        let entity = app.entity [ entityId ]
        let xp = x
        let yp = y
        if ( ermCfg[ appId+'/'+entityId ] ) {
          xp = ermCfg[ appId+'/'+entityId ].x
          yp = ermCfg[ appId+'/'+entityId ].y
        } else {
          x += 150
          if ( x > 900 ) {
            x = 100
            y += 150
          }
         }
        let e = {
          appId    : appId,
          appName  : app.title,
          entityId : appId+'/'+entityId,
          id       : entityId,
          name     : entity.title,
          x : xp,
          y : yp,
          color : cols[i],
          rel : {}
        }
        for ( let prpId in entity.properties ) {
          let prop = entity.properties[ prpId ]
          if ( prop.type == 'SelectRef' ) {
            e.rel[ prpId ] = {
              toEntity : prop.selectRef,
              mFrm     : 'n',
              mTo      : '1'
            }
          } else if ( prop.type == 'DocMap' ) {
            try {
              let p = prop.docMap.split('/') // this is scope/app/ver/ent/prop
              e.rel[ prpId ] = {
                toEntity : p[0] +'/'+ p[1] +'/'+ p[2]  +'/'+ p[3], // this is scope/app/ver
                mFrm     : '1',
                mTo      : 'n'
              }
            } catch ( exc ) { log.warn( 'ERM rel', exc ) }
          } else if ( prop.type == 'MultiSelectRef' ) {
            e.rel[ prpId ] = {
              toEntity : prop.multiSelectRef,
              mFrm     : 'n',
              mTo      : 'm'
            }
          }
        }

       
        erm.entity[ appId+'/'+entityId ] = e 
      }
    
      i++
      if ( i == cols.length ) { i = 0 }

    } catch ( exc ) { log.error( 'GET erm', exc)} }
    res.send( erm )
  }
}

async function saveERM( req, res ) {
  try {
    log.debug( 'POST erm' )
    let user = await userDta.getUserInfoFromReq( gui, req )
    if ( ! user ) { return res.status(401).send( 'login required' ) }
    let ermCfg = {}
    for ( let e in req.body.entity ) {
      ermCfg[ e ] = {
        x : req.body.entity[ e ].x,
        y : req.body.entity[ e ].y
      }
    }
    await dta.addDataObj( 'erm', user.scopeId, ermCfg )
  } catch ( exc ) { log.error( 'POST erm', exc ) } 
  res.send( {} )
}

// ============================================================================

async function addScope( req, res ) {
  let user = await userDta.getUserInfoFromReq( gui, req )
  if ( ! user ) { return res.status(401).send( 'login required' ) }
  if ( ! req.body.scopeId || ! req.body.scopeId.startsWith( user.scopeId ) || ! isScopeId( req.body.scopeId ) ) {
    log.warn( 'POST scope: id invalid', req.body.scopeId )
    return res.status(400).send('Scope ID invalid') 
  }
  let scopes = await userDta.geScopeArr( user.rootScopeId )
  let resultTxt = 'Scope added'
  for ( let scope of scopes ) {
    if ( scope.id == req.body.scopeId ) {
      log.info( 'POST scope: id exists', req.body.scopeId )
      resultTxt = 'Scope updated'
    }
  }
  let name = ( req.body.name ? req.body.name : req.body.scopeId )
  let tags = ( req.body.tags ?  req.body.tags.split(',') : [] )
  let meta = {}
  if ( req.body.metaJSON &&  req.body.metaJSON.trim().startsWith('{') ) { try {
      meta = JSON.parse( req.body.metaJSON )
  } catch ( exc ) { res.status(400).send('Meta Data not a valid JSON')  } }
  await userDta.addScope( req.body.scopeId, name, tags, meta )
  res.send( resultTxt ) 
}

async function getScope( req, res ) {
  log.debug( 'getScope', req.query )
  let user = await userDta.getUserInfoFromReq(gui,  req )
  if ( ! user ) { return res.status(401).send( 'login required' ) }
  let scopeArr = await userDta.geScopeArr( user.scopeId )

  if ( req.query.id ) { // get by id 

    for ( let scope of scopeArr ) {
      if ( scope.id == req.query.id ) {
        log.info('sc',scope )
        let resultScope = {
          scopeId  : scope.id,
          name     : scope.name,
          tags     : scope.tagArr,
          metaJSON : ( scope.meta ? JSON.stringify( scope.meta, null, ' ' )  : '' )
        }
        return res.send( resultScope )
      }
    }
    return res.send( null ) // id not in scopes
 
  } else { // get all related scopes

    let scopeTbl = []
    for ( let scope of scopeArr ) {
      let rec = {
        id : scope.id,
        name : scope.name,
        tagStr : scope.tagArr.join()
      }
      for ( let tag of scope.tagArr ) {
        rec[ "tag"+tag ] = true
      }
      scopeTbl.push( rec )
    }
    res.send( scopeTbl )   
  }
}

async function getScopeOpts( req, res ) {
  log.debug( 'getScopeOpts' )
  let user = await userDta.getUserInfoFromReq(gui,  req )
  if ( ! user ) { return res.status(401).send( 'login required' ) }
  let scopeArr = await userDta.geScopeArr( user.scopeId )
  let scopeTbl = []

  scopeTbl.push(  {
    id   : '-',
    name : 'all'
  } )
  for ( let scope of scopeArr ) {
    scopeTbl.push({
      id   : scope.id,
      name : scope.name
    })
  }
  res.send( scopeTbl )   
  
}

async function  getScopeTbl( req, res ) {
  let user = await userDta.getUserInfoFromReq( gui, req )
  if ( ! user ) { return res.status(401).send( 'login required' ) }
  let tbl = {
    dataURL: "",
    rowId: "id",
    cols: [
      { id: 'Edit', label: "&nbsp;", cellType: "button", width :'5%', icon: 'ui-icon-pencil', 
        method: "GET", setData: [ { resId : 'AddScope' } ] } ,
      { id: "id",    label: "Id",   width: "20%", cellType: "text" },
      { id: "name",  label: "Name", width: "20%", cellType: "text" },
      // { id: "tag",   label: "Tags", width: "20%", cellType: "text" },
    ]
  }
  let scopeArr = await userDta.geScopeArr( user.scopeId )
  let tags = getAllTags( scopeArr )
  for ( let aTag of tags ) {
    tbl.cols.push({ id: 'tag'+aTag, label: aTag, width: "5%", cellType: "checkbox" })
  }
  res.send( tbl )
}

// --------------------------------------------------------------------------

async function getApp( req, res )  {
  log.debug( 'GET app' )
  let user = await userDta.getUserInfoFromReq( gui, req )
  if ( ! user ) { return res.status(401).send( 'login required' ) }
  let appId = req.query.id
  if ( appId ) {
    let app = await dta.getAppById( appId )
    res.send( app )
  } else {
    let appMap = await dta.getAppList( user.scopeId, [], 'admin' )
    let apps = []
    for ( let appId in appMap ) {
      let app = appMap[ appId ]
      apps.push({
        active : ( app.role.length > 0),
        id : appId,
        title : app.title,
        scope : ( app.scopeId ? app.scopeId : 'all' ),
        tags  : getTagsCSV( app.scope ),
        role  : ( app.role ? app.role.join() : '' ),
        entitiesLnk :'<a href="index.html?layout=AppEntities-nonav&id='+appId+'">Manage Entities</a>',
        pagesLnk :'<a href="index.html?layout=AppPages-nonav&id='+appId+'">Manage Pages</a>',
        appLnk :'<a href="index.html?layout=AppEntity-nonav&id='+appId+','+app.startPage+'">Open App</a>',
        expLnk :'<a href="app/json/'+appId.replaceAll('/','_').replace('_','/')+'" target="_blank">Export</a>'
      })
    }
    res.send( apps )
  }
}


async function getAppForCustomize( req, res )  {
  log.debug( 'GET app/customize' )
  let user = await userDta.getUserInfoFromReq( gui, req )
  if ( ! user ) { return res.status(401).send( 'login required' ) }
  if ( ! req.query.id ) { return res.status(400).send( 'id required' ) }
  let app = await dta.getAppById( req.query.id )
  if ( ! app ) { return res.status(400).send( 'for found' ) }
  let appId = req.query.id

  let cApp = {
    appId : appId.substring( appId.indexOf('/') + 1 ),
    name  : app.title,
    scope : ( app.scopeId ? app.scopeId : '-' ),
    tags  : getTagsCSV( app.scope ),
    role  : ( app.role.length > 0 ? app.role[0] : '-' )
  }

  res.send( cApp )
}


async function getAppJSON( req, res )  {
  log.info( 'GET app/json', req.params.id )
  let user = await userDta.getUserInfoFromReq( gui, req )
  if ( ! user ) { return res.status(401).send( 'login required' ) }
  if ( ! req.params.scope ) { return res.status(400).send( 'scope required' ) }
  if ( ! req.params.id ) { return res.status(400).send( 'id required' ) }

  let appId = req.params.id.replaceAll( '_', '/' )
  let app = await dta.getAppById( req.params.scope +'/'+ appId )

  if ( ! app ) { return res.status(400).send( 'for found' ) }

  let appCopy = JSON.parse( JSON.stringify( app ) )
  appCopy.require = []
  for ( let entityId in appCopy.entity ) {
    let entity = appCopy.entity[ entityId ]
    for ( propId in entity.properties ) {
      let prop = entity.properties[ propId ]
      switch ( prop.type ) {
        case 'DocMap' : 
          prop.docMap = stripScopeFrmId( prop.docMap )
          addRefApp( appCopy.require, prop.docMap )
          break
        case 'SelectRef' : 
          prop.selectRef = stripScopeFrmId( prop.selectRef )
          addRefApp( appCopy.require, prop.selectRef )
          break
        case 'MultiSelectRef' : 
          prop.multiSelectRef = stripScopeFrmId( prop.multiSelectRef )
          addRefApp( appCopy.require, prop.multiSelectRef )
          break
        default: break
      }
    }
  }

  let exportApp = {}
  exportApp[ appId ] = appCopy
  res.json( exportApp )
}

function stripScopeFrmId( refId ) { 
  return refId.substring( refId.indexOf('/') +1 )
}
function addRefApp( requireArr, refId ) { 
  let appId = refId.substring( 0, refId.lastIndexOf('/') )
  if ( requireArr.indexOf( appId ) == -1 ) { 
    requireArr.push( appId )
  }
}

// ============================================================================
let uploadResult = '... '

async function uploadAppJSON( req, res ) {
  let user = await userDta.getUserInfoFromReq( gui, req )
  log.info( 'POST /app/json', user  ) // , req.files.file.data
  if ( ! user ) { return res.status(401).send( 'login required' ) }
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).send('No files were uploaded.');
  }
  try {
    let newApps = JSON.parse( '' + req.files.file.data )
    let dbApps = await  dta.getAppList( user.scopeId, [], 'admin' )
    uploadResult = 'Parsed successfully'
    uploadOK     = true
    for ( let appId in newApps ) {
      if ( dbApps[ user.rootScopeId +'/'+ appId ] ) {
        uploadResult += '<p> ERROR, ALREADY EXISTS: App ID <b>' + appId + '</b>'
        uploadOK = false
        continue 
      } 
      let app = newApps[ appId ]
      uploadResult += '<p> App ID: <b>' + appId  + '</b>'
      for ( let requireAppId of app.require ) {
        if ( dbApps[ user.rootScopeId +'/'+ requireAppId ] ) {
          uploadResult += '<br> Dependency: ' +  user.rootScopeId +'/'+ requireAppId + ' ... already available'
        } else  if ( newApps[ requireAppId ] ) {
          uploadResult += '<br> Dependency uploaded: ' + requireAppId 
        } else {
          uploadResult += '<br> ERROR: Dependency: NOT FOUND'
          uploadOK = false
        }
      }
    }
    if ( uploadOK ) {
      for ( let appId in newApps ) {
        uploadResult += '<p> TODO load to DB ' + appId
      }
    } else {
      uploadResult += '<p> <b> UPLOAD FAILED! </b>'
    }
   
  } catch ( exc ) {  
    log.warn( 'uploadAppJSON', exc )
    return res.status(400).send( 'Error' )
  }

  
  res.send( 'OK' )
}

async function getUploadAppResult( req, res ) {
  log.info( 'GET /app/json/html'  ) // , req.files.file.data
  let user = await userDta.getUserInfoFromReq( gui, req )
  if ( ! user ) { return res.status(401).send( 'login required' ) }
  res.send( uploadResult )
  uploadResult = '... '
}

// ============================================================================

function getTagsCSV( scope ) {
  let tags = []
  for ( let tag in scope ) {
    if ( tag.startsWith('#') ) {
      tags.push( tag.substring(1) )
    }
  }
  return tags.join()
}


async function addApp( req, res ) {
  let user = await userDta.getUserInfoFromReq( gui, req )
  if ( ! user ) { return res.status(401).send( 'login required' ) }
  let appId =  user.scopeId +'/'+ req.body.appId
  log.info( 'POST /app', req.body )
  let app = await dta.getAppById( appId )
  if ( ! app ) {
    app = {
      require   : {},
      entity    : {},
      page      : {},
      startPage : []
    }
  }
  app.scopeId = ( req.body.scope == '-' ? null : req.body.scope )
  app.title   = ( req.body.name ? req.body.name : req.body.id )
  if ( req.body.role == '-' ) {
    app.role = []
  } else {
    app.role = [ req.body.role ]
  }
 
  let scope = {}
  if ( req.body.tags ) {
    let tags = req.body.tags.split(',')
    for ( let tag of tags ) {
      scope[ '#'+tag ] = {
        role   : app.role
      }
    }
  }
  app.scope = scope

  await dta.addApp( appId, app)
  res.send( 'OK' )
}

// --------------------------------------------------------------------------

async function getEntity( req, res )  {
  log.info( 'GET entity',  req.query )
  let user = await userDta.getUserInfoFromReq( gui, req )
  if ( ! user ) { return res.status(401).send( 'login required' ) }

  let appId = ( req.query.appId ? req.query.appId : req.query.id )
  let app = await dta.getAppById( appId )
  if ( ! app ) { log.warn('GET entity: app not found'); return res.status(400).send([]) }
  if ( ! app.startPage ) { app.startPage = [] }

  if (  req.query.appId &&  req.query.entityId && ! req.query.title  ) { // get by id 
  
    if ( app.entity[ req.query.entityId ] ) {
      let entity = app.entity[ req.query.entityId ]
      return res.send({
        appId      : appId,
        entityId   : req.query.entityId,
        title      : entity.title,
        scope      : entity.scope,
        maintainer : entity.maintainer,
        start      : ( app.startPage.indexOf( req.query.entityId ) < 0 ? false : 'start' )
      }) 

    } else { return res.send( null )  } // id not in scopes
  
  } else {  // get by abb id
  
    let entityArr = []
    for ( let entityId in app.entity ) {
      let entity = app.entity[ entityId ]
      entityArr.push({
        entityId   : entityId,
        appId      : appId,
        title      : entity.title,
        scope      : entity.scope,
        startPage  : ( app.startPage.indexOf( entityId ) < 0 ? '': 'Y' ),
        maintainer : entity.maintainer,
        propLnk :'<a href="index.html?layout=AppEntityProperties-nonav&id='+appId+','+entityId+'">Manage Properties</a>'
      })
    }
    res.send( entityArr )
  }
}

async function addEntity( req, res ) {
  log.info( 'POST entity', req.body )
  let user = await userDta.getUserInfoFromReq( gui, req )
  if ( ! user ) { return res.status(401).send( 'login required' ) }

  let app = await dta.getAppById( req.body.appId )
  if ( ! app ) { log.warn('GET entity: app not found'); return res.status(400).send("App Id not found") }
  if ( ! app.startPage ) { app.startPage = [] }

  let newEntity = {
    title : req.body.title,
    scope : req.body.scope,
    maintainer : [req.body.maintainer],
    properties : {}
  }

  if ( req.body.start ) {
    if ( app.startPage.indexOf( req.body.entityId ) == -1 ) {
      app.startPage.push( req.body.entityId )
    }
  } else {
    if ( app.startPage.indexOf( req.body.entityId ) >= 0 ) {
      app.startPage.splice( app.startPage.indexOf( req.body.entityId ), 1 )
    }
  }

  log.info( 'POST app', newEntity )
  if ( ! app.entity ) { app.entity = {} }
  let resultTxt = ( app.entity[ req.body.entityId ] ? 'Updated' : 'Created' )
  app.entity[ req.body.entityId ] = newEntity
  await dta.saveApp( req.body.appId, app )
  res.send( resultTxt )
}


async function delEntity( req, res ) {
  log.info( 'DELETE entity', req.query )
  let user = await userDta.getUserInfoFromReq( gui, req )
  if ( ! user ) { return res.status(401).send( 'login required' ) }
  if ( ! req.query.appId || ! req.query.entityId ) { return res.status(401).send( 'appId and entityId required' ) }

  let app = await dta.getAppById( req.query.appId )
  if ( ! app ) { log.warn('GET entity: app not found'); return res.status(400).send("App not found") }
  if ( app.entity[ req.query.entityId ] ) {
    delete app.entity[ req.query.entityId ]
    await dta.saveApp( req.query.appId, app )
    res.send( 'Entity deleted!')
  } else { 
    return res.status(401).send( 'Entity not found' )
  }
}

// --------------------------------------------------------------------------

async function getProperty( req, res ) {
  log.debug( 'GET /app/entity/property', req.query )
  let appId = ( req.query.appId ? req.query.appId : req.query.id.split(',')[0] )
  if ( ! appId ) { return res.status(400).send([]) }
  let entityId = ( req.query.entityId ? req.query.entityId : req.query.id.split(',')[1] )
  let app = await dta.getAppById( appId )
  // log.info( 'GET /app/entity/property', appId, entityId, app )
  if ( ! app ) { log.warn('GET entity: /app/entity/property not found'); return res.status(400).send([]) }
  if ( ! app.entity ) { app.entity = {} }
  if ( ! app.entity[ entityId ] ) {  log.warn('GET /app/entity/property: app entity not found'); return res.status(400).send([]) }
  if ( req.query.propId && ! req.query.id ) { // property by id
    let dbProp = app.entity[ entityId ].properties[ req.query.propId ]
    if ( ! dbProp ) { return res.send( null ) }
    let prop = {
      appId    : appId,
      entityId : entityId,
      propId   : req.query.propId,
      type     :  dbProp.type,
      label    : ( dbProp.label ? dbProp.label : '' ),
      filter   : ( dbProp.filter ? true : false ),
      apiManaged : ( dbProp.apiManaged ? true : false ),
    }
    switch ( dbProp.type ) {
      case 'Select':
        prop.ref = dbProp.options.join()
        break 
      case 'SelectRef':
        prop.ref  = dbProp.selectRef
        break 
      case 'DocMap':
        prop.ref  = dbProp.docMap
        break 
      case 'Ref':
        prop.ref  = dbProp.ref
        break 
      case 'RefArray':
        prop.ref  = dbProp.refArray
        break 
      case 'Link':
        prop.ref  = dbProp.link
        break 
      case 'Event':
        prop.ref  = dbProp.event
        break 
      default: break 
    }

    return res.send( prop )
  } 
  
  // else ... property array

  let propArr = []
  for ( let propId in app.entity[ entityId ].properties ) {
    let prop = app.entity[ entityId ].properties[ propId ]
    let pType = ( prop.type ? prop.type : "?" )
    
    switch ( pType ) {
      case 'Select':
        pType = "Select: ["+prop.options.join()+']'
        break 
      case 'SelectRef':
        pType = "SelectRef: " + genLink( 'AppEntityProperties-nonav', prop.selectRef ) 
        break 
      case 'MultiSelectRef':
        pType = "MultiSelectRef: " + genLink( 'AppEntityProperties-nonav', prop.multiSelectRef ) 
        break 
      case 'DocMap':
        pType = "DocMap: " + genLink( 'AppEntityProperties-nonav',  prop.docMap )
        break 
      case 'Ref':
        pType = "Ref: "+ + genLink( 'AppEntityProperties-nonav', prop.ref ) 
        break 
      case 'RefArray':
        pType = "RefArray: "+prop.refArray
        break 
      case 'Link':
        pType = "Link: "+prop.link
        break 
      case 'Event':
        pType = 'Event: '+prop.event
        break 
      default: break 
    }
    propArr.push({
      appId    : appId,
      entityId : entityId,
      propId   : propId,
      label    : prop.label,
      type     : pType,
      filter   : ( prop.filter   ? true : false ),
      api      : ( prop.apiManaged ? true : false ),

    })
  }
  res.send( propArr )
}

function genLink( page, id ) {
  let param = getRefId( id )
  let lnk = 'index.html?layout='+page+'&id='+param
  let ref = '<a href="'+lnk+'">'+id+'</>'
  return ref 
}

function getRefId( id ) {
  let param = ''
  try {
    let p = id.split('/')
    param = p[0] +'/'+ p[1] +'/'+ p[2] +','+ p[3]
  } catch ( exc ) { log.warn( 'gen link failed', id, exc ) }
  return param
}

async function addProperty ( req, res ) {
  log.info( 'addProperty', req.body )
  let id = req.body.propId
  let addResultTxt = ''
  if ( ! id ) { log.warn('POST /entity/property: id required'); return res.status(400).send("Id required") }
  if ( ! isValidId( id ) ) { log.warn('POST /entity/property: id invalid'); return res.status(400).send("Id invalid") }
  let app = await dta.getAppById( req.body.appId )
  if ( ! app ) { log.warn('POST /entity/property: app not found'); return res.status(400).send("App Id not found") }
  if ( ! app.entity ) { app.entity = {} }
  let entity = app.entity[ req.body.entityId ]
  if ( ! entity ) { log.warn('POST /entity/property: entity not found'); return res.status(400).send("Entity Id not found") }
  entity.properties[ id ] = { }
  if ( req.body.label ) { entity.properties[ id ].label = req.body.label }
  entity.properties[ id ].type = req.body.type 

  if ( req.body.filter  ) { 
    entity.properties[ id ].filter = true 
  } else {
    delete entity.properties[ id ].filter
  }

  if ( req.body.apiManaged  ) { 
    entity.properties[ id ].apiManaged = true 
  } else {
    delete entity.properties[ id ].apiManaged
  }

  // special types need additional info
  if ( req.body.type == 'Select' ) {

    entity.properties[ id ].options = req.body.ref.split(',')

  } else   if ( req.body.type == 'Link' ) {

    entity.properties[ id ].link = req.body.ref

  } else   if ( req.body.type == 'Event' ) {

    entity.properties[ id ].event = req.body.ref

  } else if ( ['DocMap','SelectRef','RefArray','Ref'].includes(  req.body.type ) ) {

    if ( ! req.body.ref ) {
      return res.status(400).send( '"ref" is required' ) 
    }
    let p = req.body.ref.split('/')
    if ( req.body.type == 'DocMap'  ) { 
      if ( p.length != 5 ) {
        return res.status(400).send( '"ref" format must be like  "scope/app/version/entity/prop"' ) 
      }
    } else if ( p.length != 4 ) { // shpuld be  scope/app/version/entity
      return res.status(400).send( '"ref" format must be like  "scope/app/version/entity"' ) 
    }
    let refAppId    = p[0] +'/'+ p[1] +'/'+ p[2]
    let refEntityId = p[3]
    let refApp =  await dta.getAppById( refAppId )
    if ( ! refApp ) {
      return res.status(400).send( '"ref" app "'+refAppId+'" not found' ) 
    }
    if ( ! refApp.entity[ refEntityId] ) {
      refApp.entity[ refEntityId ] = {
        title : refEntityId,
        scope : 'inherited',
        maintainer : ['appUser'],
        properties : {}
      }
      addResultTxt += ', created new entity "'+ req.body.ref + '"'
    }
    switch ( req.body.type ) {
      case 'DocMap':
        let refPropertyId = p[4]
        if ( ! refApp.entity[ refEntityId ].properties[ refPropertyId ] ) {
          refApp.entity[ refEntityId ].properties[ refPropertyId ] = {
            type: "String"
          }
          addResultTxt += ', created property "'+ refPropertyId + '"'
        }
        entity.properties[ id ].docMap = req.body.ref
        break
      case 'SelectRef':
        entity.properties[ id ].selectRef = req.body.ref
        break
      case 'RefArray':
        entity.properties[ id ].refArray = req.body.ref
        break
      case 'Ref':
        entity.properties[ id ].ref = req.body.ref
        break
      default: break
    }
  }
  log.info( 'addProperty e', entity.properties[ id ] )

  await dta.saveApp( req.body.appId, app )
  res.send( 'Added' + addResultTxt )
}


async function delProperty( req, res ) {
  log.info( 'DELETE property', req.query )
  let user = await userDta.getUserInfoFromReq( gui, req )
  if ( ! user ) { return res.status(401).send( 'login required' ) }
  if ( ! req.query.appId || ! req.query.entityId || ! req.query.propId ) { 
    return res.status(401).send( 'appId and entityId required' ) 
  }

  let app = await dta.getAppById( req.query.appId )
  if ( ! app ) { log.warn('GET entity: app not found'); return res.status(400).send("App not found") }
  if ( app.entity[ req.query.entityId ] ) {
    if ( app.entity[ req.query.entityId ].properties[ req.query.propId ] ) {
      delete app.entity[ req.query.entityId ].properties[ req.query.propId ]
      await dta.saveApp( req.query.appId, app )
      res.send( 'Property deleted!')
    }  else { 
      return res.status(401).send( 'Property not found' )
    }
  } else { 
    return res.status(401).send( 'Entity not found' )
  }
}

// ============================================================================

function isValidId( str ) {
  return /^[a-zA-Z]+[a-zA-Z0-9]+$/.test( str )
}


function isScopeId( str ) {
  return /^(\/{0,1})[A-Za-z0-9\/\-_]+?$/.test( str )
}

function getAllTags( scopeArr ) {
  let tags = []
  for ( let scope of scopeArr ){
    for ( let aTag of scope.tagArr ) {
      if ( tags.indexOf( aTag ) == -1 ) {
        tags.push( aTag )
      }
    }
  }
  return tags
}