name=snap

build/$(name).umd.js: src/index.ts src/$(name).ts src/loading-indicator.ts
	rollup -c

build/$(name).min.js: build/$(name).umd.js
	uglifyjs --compress --mangle -o build/$(name).min.js -- build/$(name).umd.js

all: build/$(name).umd.js build/$(name).min.js
