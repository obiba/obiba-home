var args = require('minimist')(process.argv.slice(2));
var credential = {
  login: 'administrator',
  password: 'password'
};

module.exports = function (chromy, scenario) {
  console.log('Host', args.host);
  chromy.goto( args.host + '/user/login')
  .type('input[id=edit-name]', credential.login)
  .type('input[id=edit-pass]', credential.password)
  .click('button[type=submit]')
  .sleep(1000);

  var postInteractionWait = scenario.postInteractionWait;

  if (postInteractionWait) {
    chromy.wait(postInteractionWait);
  }
};
