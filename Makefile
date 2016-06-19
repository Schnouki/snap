name=instantclick

build/$(name).js: src/index.ts src/instantclick.ts src/loading-indicator.ts vendor/polyfill.ts
	rollup -c

build/$(name).min.js: build/$(name).js
	uglifyjs --compress --mangle -o build/$(name).min.js -- build/$(name).js

all: build/$(name).js build/$(name).min.js
