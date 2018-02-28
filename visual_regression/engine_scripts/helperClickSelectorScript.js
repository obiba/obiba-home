module.exports = function (chromy, scenario) {
  var slectorsClicks = scenario.clicksSelectors;
  var clickSelector = scenario.clickSelector;
  var inputText = scenario.inputText;
  if (clickSelector) {
    chromy
      .sleep(600)
      .click(clickSelector)
      .sleep(600);
  }

  if(slectorsClicks){
    slectorsClicks.forEach(function(selectorClick){
      chromy
        .wait(selectorClick)
        .click(selectorClick)
        .sleep(600);
    });
  }

  if(inputText){
    chromy
      .type(inputText.selector, inputText.text)
      .sleep(600);
  }

  var postInteractionWait = scenario.postInteractionWait;
  if (postInteractionWait) {
    chromy.wait(postInteractionWait);
  }
  else{
    chromy.wait(scenario.delay);
  }

  if (scenario.hasOwnProperty('removeSelectors')) {
    scenario.removeSelectors.forEach(function (selector) {
      chromy
      .evaluate(`window._backstopSelector = '${selector}'`)
      .evaluate(function(){
            Array.prototype.forEach.call(document.querySelectorAll(window._backstopSelector), function (s, j) {
              s.style.display = 'none';
              s.classList.add('__86d');
            });
          }
      );
    });
  }
};
