/* LOWCODE-DATA-APP / copyright 2024 by ma-ha https://github.com/ma-ha  /  MIT License */

const log       = require( '../helper/log' ).logger
const helper    = require( '../helper/helper' )
const fs        = require( 'fs' )
const { mkdir, writeFile, readFile, rename, rm, stat } = require( 'node:fs/promises' )
const { createHash, randomBytes } = require( 'node:crypto' )

exports: module.exports = { 
  init,
  authenticate,
  setSelScope,
  getSelScope,
  getSelScopeName,
  getUser,
  getUserInfo,
  getUserInfoFromReq,
  geScopeArr,
  getScopeName,
  getScopeList,
  addScope,
  addUser,
  updateUser,
  getUserArr,
  getApiAppScopes,
  loadOidcSessions,
  saveOidcSessions
}

// ============================================================================

let userScopeCache = null

let SCOPE_DB      = '../dta/scope.json'
let USER_AUTH_DB  = '../dta/user-auth.json'
let USER_SCOPE_DB = '../dta/user-scope.json'
let OICD_SESSION_DB = '../dta/oidc-session.json'

let FAKE_LOGIN = false

async function init( dbDir, fakeLogin ) {
  if ( fakeLogin ) { FAKE_LOGIN = fakeLogin }
  SCOPE_DB        = dbDir + 'scope.json'
  USER_AUTH_DB    = dbDir + 'user-auth.json'
  USER_SCOPE_DB   = dbDir + 'user-scope.json'
  OICD_SESSION_DB = dbDir + 'oidc-session.json'
}

async function getUserScope() {
  // if ( ! userScopeCache ) {
    if ( fs.existsSync( USER_SCOPE_DB  ) ) {
      userScopeCache = JSON.parse( await readFile( USER_SCOPE_DB ) )
    } else {
      userScopeCache = {}
    }
  // } 
  return userScopeCache
}
async function writeUserScope() {
  await writeFile( USER_SCOPE_DB, JSON.stringify( userScopeCache, null, '  ' ) )
}


async function getScope() {
  // if ( ! scopeCache ) {
    if ( fs.existsSync( SCOPE_DB  ) ) {
      scopeCache = JSON.parse( await readFile( SCOPE_DB ) )
    } else {
      scopeCache = {}
    }
  // } 
  return scopeCache
}
async function writeScope() {
  await writeFile( SCOPE_DB, JSON.stringify( scopeCache, null, '  ' ) )
}


async function getAuthTbl() {
  // if ( ! authTblCache ) {
    if ( fs.existsSync( USER_AUTH_DB  ) ) {
      authTblCache = JSON.parse( await readFile( USER_AUTH_DB ) )
    } else {
      // authTblCache = {}
    }
  // } 
  return authTblCache
}
async function writeAuthTbl() {
  await writeFile( USER_AUTH_DB, JSON.stringify( authTblCache, null, '  ' ) )
}

// ============================================================================

async function authenticate( uid, pwd ) {
  let authTbl = await getAuthTbl()
  if ( authTbl[ uid ] && authTbl[ uid ].password == createHash('sha256').update( pwd ).digest('hex') ) {
    authTbl[ uid ].lastLogin = Date.now()
    await writeAuthTbl()
    log.info( 'authenticate ok', uid  )
    return true
  }
  log.warn( 'authenticate failed', uid  )
  return false
}

async function setSelScope( userId, scope ) {
  let authTbl = await getAuthTbl()
  if ( ! authTbl[ userId ] ) { return null }
  let userScope = await getUserScope()
  userScope[ userId ] = scope
  await  writeUserScope()
}

async function getSelScope( userId ) {
  let authTbl = await getAuthTbl()
  if ( ! authTbl[ userId ] ) { return null }
  let userScope = await getUserScope()
  if (  userScope[ userId ] ) {
    return userScope[ userId ]
  } 
  return authTbl[ userId ].role.appUser[0]
}

async function getSelScopeName( userId ) {
  let authTbl = await getAuthTbl()
  if ( ! authTbl[ userId ] ) { return '' }
  let userScope = await getUserScope()
  if (  userScope[ userId ] ) {
    return await getScopeName( userScope[ userId ] )
  } 
  return await getScopeName( authTbl[ userId ].role.appUser[0] )
}


// ============================================================================

async function getScopeName( scopeId ) {
  let scopeTbl = await getScope() 
  if ( scopeTbl[ scopeId ] ) {
    return scopeTbl[ scopeId ].name
  }
  return ""
}

async function getScopeList( userId, role='appUser' ) {
  let authTbl = await getAuthTbl()
  if ( ! authTbl[ userId ] ) { return null }
  let scopeTbl = await getScope() 
  let availableScopes = {}
  for ( let userRootScope of authTbl[ userId ].role[ role ] ) {
    // console.log( 'userRootScope', userRootScope)
    let scopeIds = []
    for ( let aScope in scopeTbl ) {
      scopeIds.push( aScope )
    }
    scopeIds.sort()
    for ( let aScope of scopeIds ) {
      if ( aScope.startsWith( userRootScope ) ) {
        // console.log( 'aScope', aScope )
        availableScopes[ aScope ] = scopeTbl[ aScope ]
      }
    }
  }
  return availableScopes
}

// ============================================================================

async function geScopeArr( rootScopeId ) {
  let scopeTbl = await getScope() 
  let scopeArr = []
  for ( let scopeId in scopeTbl ) {
    if ( scopeId.startsWith( rootScopeId ) ) {
      scopeArr.push({
        id     : scopeId,
        name   : scopeTbl[ scopeId ].name,
        tagArr : scopeTbl[ scopeId ].tag,
        meta   : scopeTbl[ scopeId ].meta
      })
    }
  }
  return scopeArr
}
async function addScope( id, name, tagArr, meta) {
  let scopeTbl = await getScope() 
  scopeTbl[ id ] = {
    name : name,
    tag  : tagArr,
    meta : meta
  }
  await writeScope() 
}

// ============================================================================

async function getUserInfoFromReq( gui, req ) {
  // log.info( 'getUserInfoFromReq' )
  let userId = await gui.getUserIdFromReq( req )
  if ( FAKE_LOGIN ) {  userId = FAKE_LOGIN  }
  if ( ! userId ) { return null }
  let user = await getUserInfo( userId )
  return user 
}

async function getUserInfo( userId ) {
  // log.info( 'getUserInfo', userId )
  let scopeId = await getSelScope( userId )
  let scopeTbl = await getScope() 
  let authTbl = await getAuthTbl()


  if ( ! scopeId ) { return null }
  let rootScope = scopeId
  if ( scopeId.indexOf('/') > 0 ) {
    rootScope = scopeId.substring(0, scopeId.indexOf('/') )  
  }
  let userInfo = {
    userId      : userId,
    name        : authTbl[ userId ].name,
    scopeId     : scopeId,
    rootScopeId : rootScope,
    scopeTags   : scopeTbl[ scopeId ].tag,
    role        : authTbl[ userId ].role
  }
  return userInfo
}


async function addUser( id, newUser ) {
  let authTbl = await getAuthTbl()
  if ( id && authTbl[ id ] ) { return 'ERROR: ID exists' }
  if ( id ) { // add user
    authTbl[ id ] = newUser
    let pwd = randomBytes(5).toString('hex')
    newUser.password = createHash('sha256').update( pwd ).digest('hex')
    await writeAuthTbl()
    return 'User added, password is "'+pwd+'"'
  } else { // add API account
    let spId = helper.uuidv4()
    newUser.password = helper.uuidv4()
    authTbl[ spId ] = newUser
    await writeAuthTbl()
    return 'API account "'+spId+'" added'
  } 
} 


async function getUser( uid, scopeId ) {
  log.info( 'getUser..' )
  let authTbl = await getAuthTbl()

  if ( uid == 'empty' ) {
    return {
      email  : '',
      name   : '',
      dev    : '',
      admin  : '',
      expire : '1y'
    }
  } else if ( uid == 'empty_sp' ) {
    return {
      sp_name   : '',
      sp_expire : '1y',
      sp_id     : ''
    }
  }

  let idnty = authTbl[ uid ]

  let ret = {
    mode   : 'update'
  }

  if ( idnty.sp ) {
    ret.sp_id     = uid
    ret.sp_name   = idnty.name
    ret.sp_expire = '1y'
  } else {
    ret.uid    = uid
    ret.email  = uid
    ret.name   = idnty.name
    ret.dev    = inScope( scopeId, idnty.role.dev )
    ret.admin  = inScope( scopeId, idnty.role.admin )
    ret.expire = '1y'
  }
  return ret
}


async function updateUser( uid, newEmail, user, scopeId, action ) {
  log.info( 'updateUser..', uid, user )
  let authTbl = await getAuthTbl()
  let idnty = authTbl[ uid ]
  if ( ! idnty ) { return 'not found' }

  if ( action == 'lock' ) {

    idnty.password = null
    await writeAuthTbl()
    return 'User login disabled!'

  } else if ( action == 'reset' ) {

    let pwd = randomBytes(5).toString('hex')
    idnty.password = createHash('sha256').update( pwd ).digest('hex')
    await writeAuthTbl()
    return 'User login reset! New password: '+ pwd
  }
   
  idnty.name    = user.name
  idnty.expires = user.expires
  
  if ( idnty.sp ) {
    // TODO ?
  } else { 
    // TODO ?
  }

  await writeAuthTbl()
  return 'OK'
}


async function getUserArr( scopeId ) {
  log.info( 'getUserArr...' )
  let authTbl = await getAuthTbl()

  let result = []
  for ( let uid in authTbl ) {
    let idnty = authTbl[ uid ]
    let isInScope  = false
    let userScope  = inScope( scopeId, idnty.role.appUser )
    let devScope   = inScope( scopeId, idnty.role.dev )
    let adminScope = inScope( scopeId, idnty.role.admin )
    let apiScope   =  inScope( scopeId, idnty.role.api )
    if ( userScope || devScope || adminScope || apiScope ) { 
      isInScope = true
    }
    let type   = 'User'
    let secret = ''
    let subs   = ''
    if ( apiScope ) {
      type   = 'API Account'
      secret = '<a href="javascript:alert(\'API Secret:\\n'+idnty.password+'\')">API-Secret</a>'
      userScope = apiScope
      subs = '<a href="index.html?layout=AppSubscription-nonav&id='+uid+'">Subscriptions</a>'
    }
    let expireStr = ''
    if ( idnty.password === null ){
      expireStr = '<span style="color:red">BLOCKED</span>'
    } else if ( idnty.expires === null ) {
      expireStr = 'unlimited'
    } else {
      expireStr = ( new Date( idnty.expires ) ).toISOString().substring(0,10).replace('T',' ')
    }
    let lastLoginStr = '-'
    if ( idnty.lastLogin ) { try {
      lastLoginStr = ( new Date( idnty.lastLogin ) ).toISOString().substring(0,16).replace('T',' ')
    } catch ( exc ) { log.warn( 'getUserArr lastLoginStr', exc ) } }
    if ( isInScope ) {
      result.push({
        id      : uid,
        type    : type,
        name    : idnty.name,
        lastLogin : lastLoginStr,
        expires : expireStr,
        scope   : userScope,
        dev     : devScope,
        admin   : adminScope,
        secret  : secret,
        subs    : subs
      })
    }
  }
  return result
}

async function getApiAppScopes( appId, appSecret ) {
  let authTbl = await getAuthTbl()

  if ( authTbl[ appId ] && authTbl[ appId ].password == appSecret ) {
    return authTbl[ appId ].role.api
  } else {
    return null
  }
}


function inScope( scopeId, scopeArr ) {
  if ( ! scopeArr ) { return null }
  for ( aScopeId of scopeArr ) {
    if ( scopeId.startsWith( aScopeId ) ) {
      return aScopeId
    }
  }
}


// ============================================================================

async function loadOidcSessions() { 
  let oidcSessions = {}
  if ( fs.existsSync( OICD_SESSION_DB ) ) {
    oidcSessions = JSON.parse( await readFile( OICD_SESSION_DB ) )
  }
  return oidcSessions
}

async function saveOidcSessions( oidcSessions ) {
  await writeFile( OICD_SESSION_DB, JSON.stringify( oidcSessions, null, '  ' ) )
}

// ============================================================================
// ============================================================================
let scopeCache = {}
// {
//   "1000": { "name": "Test Tenant", tag:[] },
//   "1000/DE": { "name": "Region Germany", tag:['region'] },
//   "1000/DE/Berlin": { "name": "City: Berlin", tag:['city','capital','huge'] },
//   "1000/DE/Hamburg": { "name": "City: Hamburg", tag:['city','huge'] },
//   "1000/DE/Munich": { "name": "City: Munich", tag:['city','huge'] },
//   "1000/DE/Essen": { "name": "City: Essen", tag:['city','huge'] },
//   "1000/DE/Bochum": { "name": "City: Bochum", tag:['city','mid'] },
//   "1000/DE/Hattingen": { "name": "City: Hattingen", tag:['city','small'] },
//   "1000/UK": { "name": "UK", tag:['region'] },
//   "2000": { "name": "Other Root Tenant", tag:[]  }
// }

let authTblCache = {}
// {
//   "demo": {
//     name: 'demo@xzy.org',
//     role: {
//       dev: [ "1000" ],
//       admin: [ "1000/DE" ],
//       appUser: [ "1000" ],
//       api: []
//     },
//     password: 'secret',
//     expires: 2234567890000
//   },
//   '5a095719-cfbe-49d3-8927-a55da94221ed': {
//     name: 'Super App',
//     role: {
//       dev: [],
//       admin: [],
//       appUser: [ ],
//       api: [  "1000"  ]
//     },
//     password: '5a095719-cfbe-49d3-8927-a55da94221ed',
//     expires: 1234567890
//   }
// }
