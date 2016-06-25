# [InstantClick](http://instantclick.io/)

Most informations you need to use InstantClick are on the link above. This version actively caches images and web pages, and **requires** ES6 Map.

## Build
```bash
npm install
make all
```

## API
```typescript
import * as InstantClick from '@alexlur/instantclick';

InstantClick.init({
  // Preload can be triggered either when users clicks the link, or
  // hover it. For mobile users it would be a touch event.
  preloadingMode?: 'mousedown' | 'mouseover' [default],

  // Preload will start after the period of delay (miliseconds) have
  // passed. Only available in mousedown mode.
  delay?: 0 [default],

  // In static mode, caches do not expire and users will always see
  // the same content as long as they stay in the page.
  static: false [default]
});

InstantClick.on('receive', function (url: string, body: HTMLBodyElement, title: string) {
  // Modify the body and title here and return an object with any
  // combination of body and title.
  return { body?, title? };
});

InstantClick.on('fetch', function (url: string) {
  // Triggered a fetch event happens.
});

InstantClick.on('change', function (isInitialLoad: boolean) {
  // Triggered when InstantClick loads the cached page.
});
```

## Tests

Tests (in the `tests` folder) are PHP-generated HTML pages with which to check how InstantClick behaves on different browsers. That’s what I use before releasing a new version to make sure there are no obvious regressions.

To access the suite of tests, run `php -S 127.0.0.1:8000` from the project’s root directory (**not** from the `tests` folder) and head to [http://127.0.0.1:8000/tests/](http://127.0.0.1:8000/tests/).
