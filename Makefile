

include mica2/Makefile
include opal/Makefile
include agate/Makefile

help: mica-help opal-help

clean:
	rm -rf target
