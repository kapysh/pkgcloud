
/*
 * authentication-test.js: Tests for pkgcloud Rackspace compute authentication
 *
 * (C) 2010 Nodejitsu Inc.
 *
 */

var should = require('should'),
    macros = require('../macros'),
    async = require('async'),
    hock = require('hock'),
    helpers = require('../../helpers'),
    mock = process.env.MOCK;

describe('pkgcloud/rackspace/database/authentication', function() {
  var client, testContext = {}, authServer, server;

  before(function(done) {
    client = helpers.createClient('rackspace', 'database');

    if (!mock) {
      return done();
    }

    async.parallel([
      function(next) {
        hock.createHock(12346, function (err, hockClient) {
          should.not.exist(err);
          should.exist(hockClient);

          authServer = hockClient;
          next();
        });
      },
      function(next) {
        hock.createHock(12345, function (err, hockClient) {
          should.not.exist(err);
          should.exist(hockClient);

          server = hockClient;
          next();
        });
      }
    ], done)

  });

  describe('The pkgcloud Rackspace Database client', function() {
    it('should have core methods defined', function() {
      macros.shouldHaveCreds(client);
    });

    it('the getVersion() method should return the proper version', function(done) {
      if (mock) {
        authServer
          .post('/v2.0/tokens', {
            auth: {
              'RAX-KSKEY:apiKeyCredentials': {
                username: 'MOCK-USERNAME',
                apiKey: 'MOCK-API-KEY'
              }
            }
          })
          .reply(200, helpers.getRackspaceAuthResponse());

        server
          .get('/')
          .reply(200, {
            versions: [
              {
                "status": "CURRENT",
                "updated": "2012-08-01T00:00:00Z",
                "id": "v1.0",
                "links": [
                  {
                    "href": "http://dfw.databases.api.rackspacecloud.com/v1.0/",
                    "rel": "self"
                  }
                ]
              }
            ]
          });
      }

      client.getVersion(function (err, versions) {
        should.not.exist(err);
        should.exist(versions);
        versions.should.be.instanceOf(Array);
        versions.should.have.length(1);

        server && server.done();
        authServer && authServer.done();
        done();
      });
    });

    describe('the auth() method with a valid username and api key', function() {

      var client = helpers.createClient('rackspace', 'database'),
          err, res;

      beforeEach(function(done) {

        if (mock) {
          authServer
            .post('/v2.0/tokens', {
              auth: {
                'RAX-KSKEY:apiKeyCredentials': {
                  username: 'MOCK-USERNAME',
                  apiKey: 'MOCK-API-KEY'
                }
              }
            })
            .reply(200, helpers.getRackspaceAuthResponse());
        }

        client.auth(function (e) {
          err = e;
          authServer && authServer.done();
          done();
        });

      });

      it('should respond with 200 and appropriate info', function() {
        should.not.exist(err);
      });

      it('should respond with a token', function () {
        should.exist(client.identity.token);
      });

      it('should update the config with appropriate urls', function () {
        should.exist(client.identity);
      });
    });

    describe('the auth() method with an invalid username and api key', function () {

      var badClient = helpers.createClient('rackspace', 'database', {
        username: 'fake',
        apiKey: 'data',
        protocol: 'http://',
        authUrl: 'localhost:12346'
      });

      var err, res;

      beforeEach(function (done) {

        if (mock) {
          authServer
            .post('/v2.0/tokens', {
              auth: {
                'RAX-KSKEY:apiKeyCredentials': {
                  username: 'fake',
                  apiKey: 'data'
                }
              }
            })
            .reply(401, {
              unauthorized: {
                message: 'Username or api key is invalid', code: 401
              }
            });
        }

        badClient.auth(function (e) {
          err = e;
          authServer && authServer.done();
          done();
        });
      });

      it('should respond with Error code 401', function () {
        should.exist(err);
        // TODO resolve identity responses
      });
    });
  });

  after(function (done) {
    if (!mock) {
      return done();
    }

    async.parallel([
      function (next) {
        authServer.close(next);
      },
      function (next) {
        server.close(next);
      }
    ], done)
  });
});
