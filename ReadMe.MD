
in order to emulate the app locally for testing, run:

```
firebase serve --only hosting,functions
```

in order to deploy:

```
firebase deploy
```

When testing, enter `localhost:5000/` in browser, or `the-teapot.web.app` for the deploy. If a change you made is not reflected in browser, it could be due to caching. Remember to hard refresh. Ctrl + F5.