module.exports = function (chromy, scenario) {
  var slectorsClicks = scenario.clicksSelectors
  var slectorstoHide = scenario.removeSelectors
  var clickSelector = scenario.clickSelector;

  if (clickSelector) {
    chromy
      .sleep(1000)
      .wait(clickSelector)
      .click(clickSelector)
      .sleep(500);
  }

  if(slectorsClicks){
    slectorsClicks.forEach(function(selectorClick){
      chromy
        .sleep(500)
        .wait(selectorClick)
        .click(selectorClick)
        .sleep(500);
    });
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
