var module = angular.module('app', []);

angular.element(document).ready(function ($http) {
    var keycloakAuth = new Keycloak('keycloak.json');

    keycloakAuth.init({ onLoad: 'check-sso' }).success(function (authenticated) {
        module.factory('Auth', function() {
            var Auth = {};

            Auth.isAuthentcated = function() {
              return authenticated;
            }

            Auth.logout = function() {
                keycloakAuth.logout();
            }

            Auth.getIdentity = function() {
                return keycloakAuth.idTokenParsed;
            }

            Auth.getToken = function() {
                return keycloakAuth.token;
            }

            Auth.refreshToken = function() {
                return window.location = keycloakAuth.createLoginUrl({
                    idpHint: 'facebook'
                });
            }

            return Auth;
        });

        module.factory('authInterceptor', function($q) {
            return {
                request: function (config) {
                    var deferred = $q.defer();

                    config.headers = config.headers || {};

                    if (!config.headers.Authorization) {
                        config.headers.Authorization = 'Bearer ' + keycloakAuth.token;
                    }

                    deferred.resolve(config);

                    if (keycloakAuth.token) {
                        keycloakAuth.updateToken(5).success(function() {
                        }).error(function() {
                            deferred.reject('Failed to refresh token');
                        });
                    }

                    return deferred.promise;
                }
            };
        });

        module.config(function($httpProvider) {
            $httpProvider.responseInterceptors.push('errorInterceptor');
            $httpProvider.interceptors.push('authInterceptor');

        });

        module.factory('errorInterceptor', function($q) {
            return function(promise) {
                return promise.then(function(response) {
                    return response;
                }, function(response) {
                    return $q.reject(response);
                });
            };
        });

        angular.bootstrap(document, ["app"]);
    }).error(function () {
        window.location.reload();
    });
});

module.controller('GlobalCtrl', function($scope, $http, $location, Auth) {
    $scope.logout = function() {
        Auth.logout();
    }

    $scope.login = function() {
      Auth.refreshToken();
    };

    $scope.authenticated = Auth.isAuthentcated();

    $scope.identity = Auth.getIdentity();

    $scope.loadSocialProfile = function() {
        $http.get('http://login.cakemail.logbox.io/auth/realms/facebook-identity-provider-realm/broker/facebook/token').success(function(data) {
            var accessTokenParameter = 'access_token=';
            var accessToken = data.substring(data.indexOf(accessTokenParameter) + accessTokenParameter.length, data.indexOf('&'));

            $http.get('https://graph.facebook.com/me?access_token=' + accessToken)
                .success(function(profile) {
                    $scope.socialProfile = profile;
                })
                .error(function(data, status, headers, config) {
                    $scope.socialProfile = 'Could not obtain social profile. Trying to refresh your token.';
                    Auth.refreshToken();
                });
        });
    }
});
