
exports: module.exports = { 
  genAppSwagger
}

function genAppSwagger( app, scopeId, appId, appVersion, cfg ) {
  let swagger = {
    swagger : "2.0",
    info : {
      title: app.title,
      // description :'',
      version : appVersion
    },
    host : cfg.HOST,
    basePath : cfg.URL_PATH + '/adapter/entity/'+scopeId+'/'+appId+'/'+appVersion,
    schemes : ['https'],
    consumes : "application/json;charset-utf-8",
    produces : "application/json;charset-utf-8",
    tags: [],
    paths : {
      // ':entityId' : {
      //   'get' : {
      //     operationId : '',
      //     summary : '',
      //     description : '',
      //     tags : [],
      //     parameters : [],
      //     response : {
      //       '200' : {
      //         describtion: 'success',
      //         // headers : {
      //         //   'xz' : {
      //         //     describtion : 'bla',
      //         //     type : 'string'
      //         //   }
      //         // },
      //         schema : {
      //           '$ref' : '#/definitions/XZY'
      //         }
      //       }
      //     }


      //   }
      // }
    },
    definitions : {
      _addDataStatusOK: {
          type : 'object',
          properties : {
            'status' : {
              type : 'string',
              describtion : 'should be "OK"'
            },
            'id' : {
              type : 'string',
              describtion : 'new record id'
            },
          }
      },
      _addDataArrayStatusOK: {
        type : 'object',
        properties : {
          'status' : {
            type : 'string',
            describtion : 'should be "OK"'
          },
          idArr : {
              type : 'array',
              items : {
                'id' : 'string'
              }
          },
          'docMap' : {
            type : 'object',
            describtion : 'changed data records in a map'
          },
        }
      },
      _changeDataStatusOK: {
        type : 'object',
        properties : {
          'status' : {
            type : 'string',
            describtion : 'should be "OK"'
          },
          'id' : {
            type : 'string',
            describtion : 'new record id'
          },
          'doc' : {
            type : 'object',
            describtion : 'changed data record'
          },
        }
      },
      _changeDataArrayStatusOK: {
        type : 'object',
        properties : {
          'status' : {
            type : 'string',
            describtion : 'should be "OK"'
          },
          'docMap' : {
            type : 'object',
            describtion : 'changed data records in a map'
          },
        }
      },
      _deleteDataStatus: {
        type : 'object',
        properties : {
          'status' : {
            type : 'string',
            describtion : 'should be "OK"'
          }
        }
      }
    }
  }
  for ( let entityId in app.entity ) {
    let entity = app.entity[ entityId ]

    swagger.paths[ '/'+ entityId ] = {
      'get': {
        responses : {
          '200' : {
            describtion: 'success',
            schema : {
              type : 'array',
              items : {
                '$ref' : '#/definitions/'+entityId  
              }
            }
          },
          '400' : { describtion: 'Parameter Error' },
          '401' : { describtion: 'Not authorized' }
        }
      },
      'post': {
        parameters : [
          { name: 'entity', 
            schema:  {
              '$ref' : '#/definitions/'+entityId
            },
            required: true, 
            in: 'body',
            describtion: 'new data record'
          }
        ],
        responses : {
          '200' : {
            describtion: 'success',  
            schema : {
              '$ref' : '#/definitions/_addDataStatusOK'
            }
          },
          '400' : { describtion: 'Parameter Error' },
          '401' : { describtion: 'Not authorized' }
        }
      },
      'put': {
        parameters : [
          { name: 'entity', 
            schema:  {
              '$ref' : '#/definitions/'+entityId
            },
            required: true, 
            in: 'body',
            describtion: 'new data record'
          }
        ],
        responses : {
          '200' : {
            describtion: 'success',
            schema : {
              'type': 'object',
              '$ref' : '#/definitions/_changeDataArrayStatusOK'
            }
          },
          '400' : { describtion: 'Parameter Error' },
          '401' : { describtion: 'Not authorized' }
        }
      },
    }
    swagger.paths[ '/'+ entityId +'/{id}' ] = {
      'get': {
        parameters : [
          { name: 'id', type: 'String', required: true, in: 'path', describtion: 'data id' }
        ],
        responses : {
          '200' : {
            describtion: 'success',
            schema : {
              type : 'object',
              items : {
                '$ref' : '#/definitions/'+entityId  
              }
            }
          },
          '400' : { describtion: 'Parameter Error' },
          '401' : { describtion: 'Not authorized' }
        }
      },
      'post': {
        parameters : [
          { name: 'id', type: 'String', required: true, in: 'path', describtion: 'data id' },
          { name: 'entity', 
            schema:  {
              '$ref' : '#/definitions/'+entityId
            },
            required: true, 
            in: 'body',
            describtion: 'new data record'
          }
        ],
        responses : {
          '200' : {
            describtion: 'success',
            schema : {
              schema : {
                '$ref' : '#/definitions/_addDataStatusOK'  
              }
            },
            '400' : { describtion: 'Parameter Error' },
            '401' : { describtion: 'Not authorized' }
          }
        }
      },
      'put': {
        parameters : [
          { name: 'id', type: 'String', required: true, in: 'path', describtion: 'data id' },
          { name: 'entity', 
            schema:  {
              '$ref' : '#/definitions/'+entityId
            },
            required: true, 
            in: 'body',
            describtion: 'new data record updates'
          }
        ],
        responses : {
          '200' : {
            describtion: 'success',
            schema : {
              'type': 'object',
              '$ref' : '#/definitions/_changeDataStatusOK'
            }
          },
          '400' : { describtion: 'Parameter Error' },
          '401' : { describtion: 'Not authorized' }
        }
      },
      'delete': {
        parameters : [
          { name: 'id', type: 'String', required: true, in: 'path', describtion: 'data id' }
        ],
        responses : {
          '200' : {
            describtion: 'success',
            schema : {
              'type': 'object',
              '$ref' : '#/definitions/_deleteDataStatus'
            }
          },
          '400' : { describtion: 'Parameter Error' },
          '401' : { describtion: 'Not authorized' }
        }
      },
    }

    if ( entity.stateModel ) {
      swagger.paths[ '/'+ entityId +'/state' ] = {
        'get': {
          '200' : {
            describtion: 'success',
            schema : {
              type : 'array',
              items : {
                '$ref' : '#/definitions/'+entityId  
              }
            }
          },
          '400' : { describtion: 'Parameter Error' },
          '401' : { describtion: 'Not authorized' }
        }
      }
      swagger.paths[ '/'+ entityId +'/state/{action}' ] = {
        'post': {
          describtion : 'Change status doing "{action}" according state model "'+entity.stateModel+'"',
          parameters : [
            { name: 'action', type: 'String', required: true, in: 'path', describtion: 'action id, ref state model' }
          ],
          '200' : {
            describtion: 'success',
            schema : {
              'type': 'object',
              '$ref' : '#/definitions/_changeDataStatusOK'
            }
          },
          '400' : { describtion: 'Parameter Error' },
          '401' : { describtion: 'Not authorized' }
        }
      }
    }
    swagger.definitions[ entityId ] = {
      type : 'object',
      describtion : entity.title,
      properties : {}
    }
    for ( let propId in entity.properties ) {
      let prop =  entity.properties[ propId ]
      swagger.definitions[ entityId ].properties[ propId ] = { }
      let sProp =  swagger.definitions[ entityId ].properties[ propId ]
      if ( prop.label ) {
        sProp.describtion = prop.label
      }
      switch ( prop.type ) {
        case 'UUID':  
          sProp.type   = 'string'
          sProp.format = 'UUIDv4'
          break;
        case 'JSON':  
          sProp.type = 'object'
          break;
        case 'SelectRef': 
          sProp.type = 'object'
          sProp['@ref'] = prop.selectRef
          break
        case 'API static string': 
          sProp.type = 'string'
          sProp.describtion = prop.apiString
          break;
        default:
          sProp.type = 'string'
          break;
      }
    }
    if ( entity.stateModel ) {
      swagger.definitions[ entityId ].properties[ '_state' ] = { 
        type : String,
        describtion : 'from "'+entity.stateModel+'" state model'
      }
    }
    swagger.definitions[ entityId ].properties[ '_cre' ] = {
      type: 'integer',
      describtion: 'Create date (epoch time stamp)'
    }
    swagger.definitions[ entityId ].properties[ '_upd' ] = {
      type: 'integer',
      describtion: 'CreLast update  (epoch time stamp)'
    }
  }

  return swagger
}