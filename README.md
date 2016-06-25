# Snap

## Build
```bash
npm install
make all
```

## API
```typescript
import * as Snap from '@alexlur/instantclick';

Snap.init({
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

Snap.on('receive', function (url: string, body: HTMLBodyElement, title: string) {
  // Modify the body and title here and return an object with any
  // combination of body and title.
  return { body?, title? };
});

Snap.on('fetch', function (url: string) {
  // Triggered a fetch event happens.
});

Snap.on('change', function (isInitialLoad: boolean) {
  // Triggered when Snap loads the cached page.
});
```

## Tests

Tests (in the `tests` folder) are PHP-generated HTML pages with which to check how Snap behaves on different browsers. That’s what I use before releasing a new version to make sure there are no obvious regressions.

To access the suite of tests, run `php -S 127.0.0.1:8000` from the project’s root directory (**not** from the `tests` folder) and head to [http://127.0.0.1:8000/tests/](http://127.0.0.1:8000/tests/).

## License
This software is released under MIT License.
Snap is heavily based on the work of [InstantClick](http://instantclick.io) of Alexandre Dieulot.
