# Visual Regression Test
Testing visual regression based on [BackStopJs](https://github.com/garris/BackstopJS) tools.
It take screenShots based on a json scenarios to test, then perform diff html reports of possible regressions
## Installation 
`make install-test`
## Workflow : 
Make a reference ----> test a target vs the reference ---> Fix issues
### Make a reference : 
`
make reference referenceUrl=http://localhost/drupal-release lagServer=1.2
`
### Perform a test : 
`
make site-test referenceUrl=http://localhost/drupal-release host=http://localhost/drupal lagServer=1.2
`
### Open last test reports in browser : 
`
make site-report referenceUrl=http://localhost/drupal-release host=http://localhost/drupal lagServer=1.2
`
#### Options:
##### site-reference / site-test / site-report
referenceUrl: (Required) The reference url (Exp : a release Version) 
host : (Required) The target to test
lagServer : (Optional) A coefficient to delay the waits on distant server

##### site-approve
referenceUrl: (Required) The reference url (Exp : a release Version) 
host : (Required) The target to test
scenariosSet : (Required on approve command) The scenario set to approve
layout : (Required) The layout search to target  




