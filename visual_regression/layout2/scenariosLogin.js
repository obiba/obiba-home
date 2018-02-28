
var pagePath = "/user/login";


var scenarios = [
  {
    "label": "User Login",
    "path": pagePath,
    "delay": 'searchLoad',
    "credential": {
      "login": "administrator",
      "password": "password"
    }
  }
];

module.exports = scenarios;
