var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-cMuQWr/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// .wrangler/tmp/bundle-cMuQWr/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// node_modules/hono/dist/compose.js
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/body.js
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value) => {
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");

// node_modules/hono/dist/utils/url.js
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const path = url.slice(start, queryIndex === -1 ? void 0 : queryIndex);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63) {
      break;
    }
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var tryDecodeURIComponent = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURIComponent_), "tryDecodeURIComponent");
var HonoRequest = /* @__PURE__ */ __name(class {
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return this.bodyCache.parsedBody ??= await parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  };
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
}, "HonoRequest");

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var Context = /* @__PURE__ */ __name(class {
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= new Response(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = new Response(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = (layout) => this.#layout = layout;
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = () => this.#layout;
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = (name, value, options) => {
    if (this.finalized) {
      this.#res = new Response(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  };
  status = (status) => {
    this.#status = status;
  };
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  };
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = (key) => {
    return this.#var ? this.#var.get(key) : void 0;
  };
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return new Response(data, { status, headers: responseHeaders });
  }
  newResponse = (...args) => this.#newResponse(...args);
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = (text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  };
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = (object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  };
  html = (html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = (location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  };
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = () => {
    this.#notFoundHandler ??= () => new Response();
    return this.#notFoundHandler(this);
  };
}, "Context");

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = /* @__PURE__ */ __name(class extends Error {
}, "UnsupportedPathError");

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = /* @__PURE__ */ __name(class _Hono {
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = (handler) => {
    this.errorHandler = handler;
    return this;
  };
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = (handler) => {
    this.#notFoundHandler = handler;
    return this;
  };
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = url.pathname.slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = { basePath: this._basePath, path, method, handler };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  };
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  };
}, "_Hono");

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  }, "match2");
  this.match = match2;
  return match2(method, path);
}
__name(match, "match");

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = /* @__PURE__ */ __name(class _Node {
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
}, "_Node");

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = /* @__PURE__ */ __name(class {
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
}, "Trie");

// node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
__name(clearWildcardRegExpCache, "clearWildcardRegExpCache");
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
__name(buildMatcherFromPreprocessedRoutes, "buildMatcherFromPreprocessedRoutes");
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = /* @__PURE__ */ __name(class {
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
}, "RegExpRouter");

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = /* @__PURE__ */ __name(class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
}, "SmartRouter");

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var Node2 = /* @__PURE__ */ __name(class _Node2 {
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #getHandlerSets(node, method, nodeParams, params) {
    const handlerSets = [];
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
    return handlerSets;
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              handlerSets.push(
                ...this.#getHandlerSets(nextNode.#children["*"], method, node.#params)
              );
            }
            handlerSets.push(...this.#getHandlerSets(nextNode, method, node.#params));
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              handlerSets.push(...this.#getHandlerSets(astNode, method, node.#params));
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          const restPathString = parts.slice(i).join("/");
          if (matcher instanceof RegExp) {
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              handlerSets.push(...this.#getHandlerSets(child, method, node.#params, params));
              if (Object.keys(child.#children).length) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              handlerSets.push(...this.#getHandlerSets(child, method, params, node.#params));
              if (child.#children["*"]) {
                handlerSets.push(
                  ...this.#getHandlerSets(child.#children["*"], method, params, node.#params)
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      curNodes = tempNodes.concat(curNodesQueue.shift() ?? []);
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
}, "_Node");

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = /* @__PURE__ */ __name(class {
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
}, "TrieRouter");

// node_modules/hono/dist/hono.js
var Hono2 = /* @__PURE__ */ __name(class extends Hono {
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
}, "Hono");

// node_modules/hono/dist/middleware/cors/index.js
var cors = /* @__PURE__ */ __name((options) => {
  const defaults = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
    allowHeaders: [],
    exposeHeaders: []
  };
  const opts = {
    ...defaults,
    ...options
  };
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return optsAllowMethods;
    } else if (Array.isArray(optsAllowMethods)) {
      return () => optsAllowMethods;
    } else {
      return () => [];
    }
  })(opts.allowMethods);
  return /* @__PURE__ */ __name(async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    __name(set, "set");
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (opts.exposeHeaders?.length) {
      set("Access-Control-Expose-Headers", opts.exposeHeaders.join(","));
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*") {
        set("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods.length) {
        set("Access-Control-Allow-Methods", allowMethods.join(","));
      }
      let headers = opts.allowHeaders;
      if (!headers?.length) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headers = requestHeaders.split(/\s*,\s*/);
        }
      }
      if (headers?.length) {
        set("Access-Control-Allow-Headers", headers.join(","));
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*") {
      c.header("Vary", "Origin", { append: true });
    }
  }, "cors2");
}, "cors");

// src/utils/jwt.ts
var encoder = new TextEncoder();
async function createHmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}
__name(createHmacKey, "createHmacKey");
function base64UrlEncode(data) {
  const str = typeof data === "string" ? data : String.fromCharCode(...data);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(base64UrlEncode, "base64UrlEncode");
function base64UrlDecode(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - base64.length % 4) % 4);
  return atob(base64 + padding);
}
__name(base64UrlDecode, "base64UrlDecode");
async function signJWT(payload, secret, expiresIn = 7 * 24 * 60 * 60) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1e3);
  const fullPayload = { ...payload, exp: now + expiresIn };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const message = `${headerB64}.${payloadB64}`;
  const key = await createHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  return `${message}.${signatureB64}`;
}
__name(signJWT, "signJWT");
async function verifyJWTWithStatus(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3)
      return { status: "invalid", payload: null };
    const [headerB64, payloadB64, signatureB64] = parts;
    const message = `${headerB64}.${payloadB64}`;
    const key = await createHmacKey(secret);
    const signatureData = Uint8Array.from(base64UrlDecode(signatureB64), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, signatureData, encoder.encode(message));
    if (!valid)
      return { status: "invalid", payload: null };
    const payload = JSON.parse(base64UrlDecode(payloadB64));
    const now = Math.floor(Date.now() / 1e3);
    if (payload.exp < now) {
      return { status: "expired", payload };
    }
    return { status: "valid", payload };
  } catch {
    return { status: "invalid", payload: null };
  }
}
__name(verifyJWTWithStatus, "verifyJWTWithStatus");

// src/utils/response.ts
function success(c, data, meta) {
  return c.json({ success: true, data, ...meta && { meta } });
}
__name(success, "success");
function error(c, code, message, status = 400) {
  return c.json({ success: false, error: { code, message } }, status);
}
__name(error, "error");
function notFound(c, message = "\uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.") {
  return error(c, "NOT_FOUND", message, 404);
}
__name(notFound, "notFound");

// src/middleware/auth.ts
async function authMiddleware(c, next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return error(c, "UNAUTHORIZED", "\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.", 401);
  }
  const token = authHeader.substring(7);
  const secret = c.env.JWT_SECRET || "dev-secret-key-change-in-production";
  const result = await verifyJWTWithStatus(token, secret);
  if (result.status === "expired") {
    return error(c, "SESSION_EXPIRED", "\uB85C\uADF8\uC778 \uC138\uC158\uC774 \uB9CC\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uB85C\uADF8\uC778\uD574\uC8FC\uC138\uC694.", 401);
  }
  if (result.status === "invalid") {
    return error(c, "INVALID_TOKEN", "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uD1A0\uD070\uC785\uB2C8\uB2E4.", 401);
  }
  c.set("user", {
    userId: result.payload.userId,
    username: result.payload.username,
    role: result.payload.role
  });
  await next();
}
__name(authMiddleware, "authMiddleware");
async function optionalAuthMiddleware(c, next) {
  const authHeader = c.req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const secret = c.env.JWT_SECRET || "dev-secret-key-change-in-production";
    const result = await verifyJWTWithStatus(token, secret);
    if (result.status === "valid") {
      c.set("user", {
        userId: result.payload.userId,
        username: result.payload.username,
        role: result.payload.role
      });
    }
  }
  await next();
}
__name(optionalAuthMiddleware, "optionalAuthMiddleware");
function requireRole(...roles) {
  return async (c, next) => {
    const user = c.get("user");
    if (!user || !roles.includes(user.role)) {
      return unauthorized(c, "\uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }
    await next();
  };
}
__name(requireRole, "requireRole");

// src/utils/password.ts
var encoder2 = new TextEncoder();
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder2.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 1e5,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );
  const hashArray = new Uint8Array(derivedBits);
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(hashArray).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${saltHex}:${hashHex}`;
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, storedHash) {
  try {
    const [saltHex, hashHex] = storedHash.split(":");
    if (!saltHex || !hashHex)
      return false;
    const salt = new Uint8Array(saltHex.match(/.{2}/g).map((byte) => parseInt(byte, 16)));
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder2.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations: 1e5,
        hash: "SHA-256"
      },
      keyMaterial,
      256
    );
    const hashArray = new Uint8Array(derivedBits);
    const computedHashHex = Array.from(hashArray).map((b) => b.toString(16).padStart(2, "0")).join("");
    return computedHashHex === hashHex;
  } catch {
    return false;
  }
}
__name(verifyPassword, "verifyPassword");

// src/routes/auth.ts
var authRoutes = new Hono2();
authRoutes.post("/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { username, password, character_name, job, level, discord, alliance_id } = body;
    if (!username || !password || !character_name) {
      return error(c, "VALIDATION_ERROR", "\uD544\uC218 \uD56D\uBAA9\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.");
    }
    if (username.length < 4 || username.length > 12) {
      return error(c, "VALIDATION_ERROR", "\uC544\uC774\uB514\uB294 4-12\uC790\uC5EC\uC57C \uD569\uB2C8\uB2E4.");
    }
    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      return error(c, "VALIDATION_ERROR", "\uC544\uC774\uB514\uB294 \uC601\uBB38/\uC22B\uC790\uB9CC \uAC00\uB2A5\uD569\uB2C8\uB2E4.");
    }
    if (password.length < 8) {
      return error(c, "VALIDATION_ERROR", "\uBE44\uBC00\uBC88\uD638\uB294 8\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.");
    }
    const existing = await c.env.DB.prepare(
      "SELECT id FROM users WHERE username = ?"
    ).bind(username).first();
    if (existing) {
      return error(c, "DUPLICATE_ERROR", "\uC774\uBBF8 \uC0AC\uC6A9 \uC911\uC778 \uC544\uC774\uB514\uC785\uB2C8\uB2E4.");
    }
    let role = "member";
    if (alliance_id) {
      const alliance = await c.env.DB.prepare(
        "SELECT is_main FROM alliances WHERE id = ?"
      ).bind(alliance_id).first();
      role = alliance?.is_main ? "member" : "honorary";
    }
    const passwordHash = await hashPassword(password);
    const result = await c.env.DB.prepare(
      `INSERT INTO users (username, password_hash, character_name, job, level, discord, alliance_id, role, is_approved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
    ).bind(username, passwordHash, character_name, job || "", level || 1, discord || "", alliance_id || null, role).run();
    return success(c, { id: result.meta.last_row_id, message: "\uD68C\uC6D0\uAC00\uC785\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uAD00\uB9AC\uC790 \uC2B9\uC778 \uD6C4 \uB85C\uADF8\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
authRoutes.post("/login", async (c) => {
  try {
    const body = await c.req.json();
    const { username, password } = body;
    if (!username || !password) {
      return error(c, "VALIDATION_ERROR", "\uC544\uC774\uB514\uC640 \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694.");
    }
    const user = await c.env.DB.prepare(
      "SELECT * FROM users WHERE username = ?"
    ).bind(username).first();
    if (!user) {
      return error(c, "AUTH_ERROR", "\uC544\uC774\uB514 \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
    }
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return error(c, "AUTH_ERROR", "\uC544\uC774\uB514 \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
    }
    if (!user.is_approved) {
      return error(c, "NOT_APPROVED", "\uAC00\uC785 \uC2B9\uC778 \uB300\uAE30 \uC911\uC785\uB2C8\uB2E4.");
    }
    await c.env.DB.prepare(
      'UPDATE users SET last_login_at = datetime("now"), is_online = 1 WHERE id = ?'
    ).bind(user.id).run();
    const secret = c.env.JWT_SECRET || "dev-secret-key-change-in-production";
    const token = await signJWT({
      userId: user.id,
      username: user.username,
      role: user.role
    }, secret);
    const { password_hash, ...userData } = user;
    return success(c, { token, user: userData });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
authRoutes.get("/me", authMiddleware, async (c) => {
  try {
    const { userId } = c.get("user");
    const user = await c.env.DB.prepare(`
      SELECT u.id, u.username, u.character_name, u.job, u.level, u.discord,
             u.profile_image, u.default_icon, u.profile_zoom, u.role, u.alliance_id, u.is_online, u.created_at,
             a.name as alliance_name, a.emblem as alliance_emblem, a.is_main as is_main_guild
      FROM users u
      LEFT JOIN alliances a ON u.alliance_id = a.id
      WHERE u.id = ?
    `).bind(userId).first();
    if (!user) {
      return error(c, "NOT_FOUND", "\uC0AC\uC6A9\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", 404);
    }
    return success(c, user);
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
authRoutes.put("/profile", authMiddleware, async (c) => {
  try {
    const { userId } = c.get("user");
    const body = await c.req.json();
    const { job, level, discord, default_icon, clear_profile_image, profile_zoom } = body;
    if (profile_zoom !== void 0 && Object.keys(body).length === 1) {
      await c.env.DB.prepare(
        'UPDATE users SET profile_zoom = ?, updated_at = datetime("now") WHERE id = ?'
      ).bind(profile_zoom, userId).run();
      return success(c, { message: "\uD655\uB300 \uC124\uC815\uC774 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
    }
    if (default_icon && clear_profile_image) {
      await c.env.DB.prepare(
        'UPDATE users SET job = ?, level = ?, discord = ?, default_icon = ?, profile_image = NULL, profile_zoom = COALESCE(?, profile_zoom), updated_at = datetime("now") WHERE id = ?'
      ).bind(job || "", level || 100, discord || "", default_icon, profile_zoom || null, userId).run();
    } else {
      await c.env.DB.prepare(
        'UPDATE users SET job = ?, level = ?, discord = ?, default_icon = ?, profile_zoom = COALESCE(?, profile_zoom), updated_at = datetime("now") WHERE id = ?'
      ).bind(job || "", level || 100, discord || "", default_icon || null, profile_zoom || null, userId).run();
    }
    return success(c, { message: "\uD504\uB85C\uD544\uC774 \uC218\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
authRoutes.post("/profile/image", authMiddleware, async (c) => {
  try {
    if (!c.env.BUCKET) {
      return error(c, "NOT_CONFIGURED", "\uC774\uBBF8\uC9C0 \uC800\uC7A5\uC18C\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.", 503);
    }
    const { userId } = c.get("user");
    const formData = await c.req.formData();
    const file = formData.get("file");
    if (!file) {
      return error(c, "VALIDATION_ERROR", "\uC774\uBBF8\uC9C0\uB97C \uC120\uD0DD\uD574\uC8FC\uC138\uC694.");
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const key = `profiles/${userId}/${crypto.randomUUID()}.${ext}`;
    await c.env.BUCKET.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type }
    });
    const imageUrl = `/api/images/${key}`;
    await c.env.DB.prepare(
      'UPDATE users SET profile_image = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(imageUrl, userId).run();
    return success(c, { url: imageUrl });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
authRoutes.get("/my-posts", authMiddleware, async (c) => {
  try {
    const { userId } = c.get("user");
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "20");
    const offset = (page - 1) * limit;
    const posts = await c.env.DB.prepare(`
      SELECT p.*, bc.name as category_name, bc.slug as category_slug
      FROM posts p
      LEFT JOIN board_categories bc ON p.category_id = bc.id
      WHERE p.user_id = ? AND p.is_deleted = 0
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all();
    const countResult = await c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM posts WHERE user_id = ? AND is_deleted = 0"
    ).bind(userId).first();
    return success(c, posts.results, {
      page,
      limit,
      total: countResult?.total || 0,
      totalPages: Math.ceil((countResult?.total || 0) / limit)
    });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
authRoutes.get("/my-comments", authMiddleware, async (c) => {
  try {
    const { userId } = c.get("user");
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "20");
    const offset = (page - 1) * limit;
    const comments = await c.env.DB.prepare(`
      SELECT c.*, p.title as post_title, p.id as post_id, bc.slug as category_slug
      FROM comments c
      LEFT JOIN posts p ON c.post_id = p.id
      LEFT JOIN board_categories bc ON p.category_id = bc.id
      WHERE c.user_id = ? AND c.is_deleted = 0
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all();
    const countResult = await c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM comments WHERE user_id = ? AND is_deleted = 0"
    ).bind(userId).first();
    return success(c, comments.results, {
      page,
      limit,
      total: countResult?.total || 0,
      totalPages: Math.ceil((countResult?.total || 0) / limit)
    });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
authRoutes.get("/my-gallery", authMiddleware, async (c) => {
  try {
    const { userId } = c.get("user");
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "20");
    const offset = (page - 1) * limit;
    const gallery = await c.env.DB.prepare(`
      SELECT * FROM gallery
      WHERE user_id = ? AND is_deleted = 0
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all();
    const countResult = await c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM gallery WHERE user_id = ? AND is_deleted = 0"
    ).bind(userId).first();
    return success(c, gallery.results, {
      page,
      limit,
      total: countResult?.total || 0,
      totalPages: Math.ceil((countResult?.total || 0) / limit)
    });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
authRoutes.get("/my-events", authMiddleware, async (c) => {
  try {
    const { userId } = c.get("user");
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "20");
    const offset = (page - 1) * limit;
    const events = await c.env.DB.prepare(`
      SELECT e.*, ep.status as participation_status, ep.created_at as joined_at
      FROM event_participants ep
      LEFT JOIN events e ON ep.event_id = e.id
      WHERE ep.user_id = ?
      ORDER BY e.event_date DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all();
    const countResult = await c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM event_participants WHERE user_id = ?"
    ).bind(userId).first();
    return success(c, events.results, {
      page,
      limit,
      total: countResult?.total || 0,
      totalPages: Math.ceil((countResult?.total || 0) / limit)
    });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
authRoutes.post("/register", async (c) => {
  try {
    const formData = await c.req.formData();
    const characterName = formData.get("character_name");
    const job = formData.get("job");
    const level = formData.get("level");
    const discord = formData.get("discord");
    const message = formData.get("message");
    const allianceId = formData.get("alliance_id");
    const imageFile = formData.get("image");
    if (!characterName || !job || !level || !discord || !allianceId) {
      return error(c, "VALIDATION_ERROR", "\uD544\uC218 \uD56D\uBAA9\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.");
    }
    const alliance = await c.env.DB.prepare(
      "SELECT is_main FROM alliances WHERE id = ?"
    ).bind(parseInt(allianceId)).first();
    const role = alliance?.is_main ? "member" : "honorary";
    const tempUsername = `pending_${Date.now()}`;
    const tempPassword = await hashPassword(crypto.randomUUID());
    let profileImage = "";
    if (imageFile && c.env.BUCKET) {
      const ext = imageFile.name.split(".").pop()?.toLowerCase() || "png";
      const key = `profiles/pending/${crypto.randomUUID()}.${ext}`;
      await c.env.BUCKET.put(key, await imageFile.arrayBuffer(), {
        httpMetadata: { contentType: imageFile.type }
      });
      profileImage = `/api/images/${key}`;
    }
    await c.env.DB.prepare(
      `INSERT INTO users (username, password_hash, character_name, job, level, discord, profile_image, alliance_id, role, is_approved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
    ).bind(tempUsername, tempPassword, characterName, job, parseInt(level), discord, profileImage, parseInt(allianceId), role).run();
    return success(c, { message: "\uAC00\uC785 \uC2E0\uCCAD\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});

// src/routes/posts.ts
var postRoutes = new Hono2();
postRoutes.get("/", optionalAuthMiddleware, async (c) => {
  try {
    const category = c.req.query("category") || "showoff";
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "10");
    const offset = (page - 1) * limit;
    const cat = await c.env.DB.prepare(
      "SELECT id FROM board_categories WHERE slug = ?"
    ).bind(category).first();
    if (!cat) {
      return error(c, "NOT_FOUND", "\uCE74\uD14C\uACE0\uB9AC\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", 404);
    }
    const posts = await c.env.DB.prepare(`
      SELECT p.*, u.character_name, u.job, u.profile_image, u.default_icon, u.profile_zoom, u.role as user_role,
             u.alliance_id, a.name as alliance_name, a.emblem as alliance_emblem, a.is_main as is_main_guild,
             (SELECT GROUP_CONCAT(image_url) FROM post_images WHERE post_id = p.id) as image_urls
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN alliances a ON u.alliance_id = a.id
      WHERE p.category_id = ? AND p.is_deleted = 0
      ORDER BY p.is_notice DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(cat.id, limit, offset).all();
    const countResult = await c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM posts WHERE category_id = ? AND is_deleted = 0"
    ).bind(cat.id).first();
    const total = countResult?.total || 0;
    const postsWithUser = posts.results.map((p) => ({
      ...p,
      user: {
        character_name: p.character_name,
        job: p.job,
        profile_image: p.profile_image,
        default_icon: p.default_icon,
        profile_zoom: p.profile_zoom,
        role: p.user_role,
        alliance_id: p.alliance_id,
        alliance_name: p.alliance_name,
        alliance_emblem: p.alliance_emblem,
        is_main_guild: p.is_main_guild
      },
      images: p.image_urls ? p.image_urls.split(",").map((url) => ({ image_url: url })) : []
    }));
    return success(c, postsWithUser, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
postRoutes.get("/:id", optionalAuthMiddleware, async (c) => {
  try {
    const id = c.req.param("id");
    const post = await c.env.DB.prepare(`
      SELECT p.*, u.character_name, u.job, u.profile_image, u.default_icon, u.profile_zoom, u.role as user_role,
             u.alliance_id, a.name as alliance_name, a.emblem as alliance_emblem, a.is_main as is_main_guild
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN alliances a ON u.alliance_id = a.id
      WHERE p.id = ? AND p.is_deleted = 0
    `).bind(id).first();
    if (!post) {
      return notFound(c, "\uAC8C\uC2DC\uAE00\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }
    await c.env.DB.prepare(
      "UPDATE posts SET view_count = view_count + 1 WHERE id = ?"
    ).bind(id).run();
    const images = await c.env.DB.prepare(
      "SELECT * FROM post_images WHERE post_id = ? ORDER BY sort_order"
    ).bind(id).all();
    return success(c, {
      ...post,
      user: {
        character_name: post.character_name,
        job: post.job,
        profile_image: post.profile_image,
        default_icon: post.default_icon,
        profile_zoom: post.profile_zoom,
        role: post.user_role,
        alliance_id: post.alliance_id,
        alliance_name: post.alliance_name,
        alliance_emblem: post.alliance_emblem,
        is_main_guild: post.is_main_guild
      },
      images: images.results
    });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
postRoutes.post("/", authMiddleware, async (c) => {
  try {
    const { userId } = c.get("user");
    const body = await c.req.json();
    const { category, title, content } = body;
    if (!title || !content) {
      return error(c, "VALIDATION_ERROR", "\uC81C\uBAA9\uACFC \uB0B4\uC6A9\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.");
    }
    const cat = await c.env.DB.prepare(
      "SELECT id FROM board_categories WHERE slug = ?"
    ).bind(category || "showoff").first();
    if (!cat) {
      return error(c, "NOT_FOUND", "\uCE74\uD14C\uACE0\uB9AC\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", 404);
    }
    const result = await c.env.DB.prepare(
      "INSERT INTO posts (category_id, user_id, title, content) VALUES (?, ?, ?, ?)"
    ).bind(cat.id, userId, title, content).run();
    return success(c, { id: result.meta.last_row_id });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
postRoutes.put("/:id", authMiddleware, async (c) => {
  try {
    const { userId, role } = c.get("user");
    const id = c.req.param("id");
    const body = await c.req.json();
    const { title, content } = body;
    const post = await c.env.DB.prepare(
      "SELECT user_id FROM posts WHERE id = ? AND is_deleted = 0"
    ).bind(id).first();
    if (!post) {
      return notFound(c, "\uAC8C\uC2DC\uAE00\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }
    if (post.user_id !== userId && role !== "master" && role !== "submaster") {
      return error(c, "FORBIDDEN", "\uC218\uC815 \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.", 403);
    }
    await c.env.DB.prepare(
      'UPDATE posts SET title = ?, content = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(title, content, id).run();
    return success(c, { message: "\uC218\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
postRoutes.delete("/:id", authMiddleware, async (c) => {
  try {
    const { userId, role } = c.get("user");
    const id = c.req.param("id");
    const post = await c.env.DB.prepare(
      "SELECT user_id FROM posts WHERE id = ? AND is_deleted = 0"
    ).bind(id).first();
    if (!post) {
      return notFound(c, "\uAC8C\uC2DC\uAE00\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }
    if (post.user_id !== userId && role !== "master" && role !== "submaster") {
      return error(c, "FORBIDDEN", "\uC0AD\uC81C \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.", 403);
    }
    await c.env.DB.prepare(
      'UPDATE posts SET is_deleted = 1, updated_at = datetime("now") WHERE id = ?'
    ).bind(id).run();
    return success(c, { message: "\uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
postRoutes.post("/:id/like", authMiddleware, async (c) => {
  try {
    const { userId } = c.get("user");
    const id = c.req.param("id");
    const existing = await c.env.DB.prepare(
      "SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?"
    ).bind(id, userId).first();
    if (existing) {
      await c.env.DB.prepare(
        "DELETE FROM post_likes WHERE post_id = ? AND user_id = ?"
      ).bind(id, userId).run();
      await c.env.DB.prepare(
        "UPDATE posts SET like_count = like_count - 1 WHERE id = ?"
      ).bind(id).run();
      return success(c, { liked: false });
    } else {
      await c.env.DB.prepare(
        "INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)"
      ).bind(id, userId).run();
      await c.env.DB.prepare(
        "UPDATE posts SET like_count = like_count + 1 WHERE id = ?"
      ).bind(id).run();
      return success(c, { liked: true });
    }
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
postRoutes.post("/:id/images", authMiddleware, async (c) => {
  try {
    if (!c.env.BUCKET) {
      return error(c, "NOT_CONFIGURED", "\uC774\uBBF8\uC9C0 \uC800\uC7A5\uC18C\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.", 503);
    }
    const { userId } = c.get("user");
    const id = c.req.param("id");
    const post = await c.env.DB.prepare(
      "SELECT user_id FROM posts WHERE id = ? AND is_deleted = 0"
    ).bind(id).first();
    if (!post || post.user_id !== userId) {
      return error(c, "FORBIDDEN", "\uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.", 403);
    }
    const formData = await c.req.formData();
    const files = formData.getAll("files");
    const uploadedUrls = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const key = `posts/${id}/${crypto.randomUUID()}.${ext}`;
      await c.env.BUCKET.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type }
      });
      const imageUrl = `/api/images/${key}`;
      uploadedUrls.push(imageUrl);
      await c.env.DB.prepare(
        "INSERT INTO post_images (post_id, image_key, image_url, sort_order) VALUES (?, ?, ?, ?)"
      ).bind(id, key, imageUrl, i).run();
    }
    return success(c, { urls: uploadedUrls });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
postRoutes.get("/:id/comments", async (c) => {
  try {
    const id = c.req.param("id");
    const comments = await c.env.DB.prepare(`
      SELECT c.*, u.character_name, u.profile_image, u.default_icon, u.profile_zoom, u.role as user_role,
             a.name as alliance_name, a.emblem as alliance_emblem, a.is_main as is_main_guild
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN alliances a ON u.alliance_id = a.id
      WHERE c.post_id = ? AND c.is_deleted = 0
      ORDER BY c.created_at ASC
    `).bind(id).all();
    const commentsWithUser = comments.results.map((c2) => ({
      ...c2,
      user: {
        character_name: c2.character_name,
        profile_image: c2.profile_image,
        default_icon: c2.default_icon,
        profile_zoom: c2.profile_zoom,
        role: c2.user_role,
        alliance_name: c2.alliance_name,
        alliance_emblem: c2.alliance_emblem,
        is_main_guild: c2.is_main_guild
      }
    }));
    return success(c, commentsWithUser);
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
postRoutes.post("/:id/comments", authMiddleware, async (c) => {
  try {
    const { userId } = c.get("user");
    const postId = c.req.param("id");
    const body = await c.req.json();
    const { content, parentId } = body;
    if (!content) {
      return error(c, "VALIDATION_ERROR", "\uB0B4\uC6A9\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.");
    }
    const result = await c.env.DB.prepare(
      "INSERT INTO comments (post_id, user_id, parent_id, content) VALUES (?, ?, ?, ?)"
    ).bind(postId, userId, parentId || null, content).run();
    await c.env.DB.prepare(
      "UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?"
    ).bind(postId).run();
    return success(c, { id: result.meta.last_row_id });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
postRoutes.delete("/:id/comments/:commentId", authMiddleware, async (c) => {
  try {
    const { userId, role } = c.get("user");
    const postId = c.req.param("id");
    const commentId = c.req.param("commentId");
    const comment = await c.env.DB.prepare(
      "SELECT user_id FROM comments WHERE id = ? AND post_id = ?"
    ).bind(commentId, postId).first();
    if (!comment) {
      return notFound(c, "\uB313\uAE00\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }
    if (comment.user_id !== userId && role !== "master" && role !== "submaster") {
      return error(c, "FORBIDDEN", "\uC0AD\uC81C \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.", 403);
    }
    await c.env.DB.prepare(
      "UPDATE comments SET is_deleted = 1 WHERE id = ?"
    ).bind(commentId).run();
    await c.env.DB.prepare(
      "UPDATE posts SET comment_count = comment_count - 1 WHERE id = ?"
    ).bind(postId).run();
    return success(c, { message: "\uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});

// src/routes/gallery.ts
var galleryRoutes = new Hono2();
galleryRoutes.get("/", optionalAuthMiddleware, async (c) => {
  try {
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "20");
    const offset = (page - 1) * limit;
    const gallery = await c.env.DB.prepare(`
      SELECT g.*, u.character_name, u.profile_image, u.default_icon, u.profile_zoom
      FROM gallery g
      LEFT JOIN users u ON g.user_id = u.id
      WHERE g.is_deleted = 0
      ORDER BY g.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();
    const countResult = await c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM gallery WHERE is_deleted = 0"
    ).first();
    const total = countResult?.total || 0;
    const galleryWithUser = gallery.results.map((g) => ({
      ...g,
      user: {
        character_name: g.character_name,
        profile_image: g.profile_image,
        default_icon: g.default_icon,
        profile_zoom: g.profile_zoom
      }
    }));
    return success(c, galleryWithUser, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
galleryRoutes.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const item = await c.env.DB.prepare(`
      SELECT g.*, u.character_name, u.profile_image, u.default_icon, u.profile_zoom
      FROM gallery g
      LEFT JOIN users u ON g.user_id = u.id
      WHERE g.id = ? AND g.is_deleted = 0
    `).bind(id).first();
    if (!item) {
      return notFound(c, "\uC774\uBBF8\uC9C0\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }
    await c.env.DB.prepare(
      "UPDATE gallery SET view_count = view_count + 1 WHERE id = ?"
    ).bind(id).run();
    return success(c, {
      ...item,
      user: {
        character_name: item.character_name,
        profile_image: item.profile_image,
        default_icon: item.default_icon,
        profile_zoom: item.profile_zoom
      }
    });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
galleryRoutes.post("/", authMiddleware, async (c) => {
  try {
    if (!c.env.BUCKET) {
      return error(c, "NOT_CONFIGURED", "\uC774\uBBF8\uC9C0 \uC800\uC7A5\uC18C\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.", 503);
    }
    const { userId } = c.get("user");
    const formData = await c.req.formData();
    const title = formData.get("title");
    const description = formData.get("description");
    const file = formData.get("file");
    if (!title || !file) {
      return error(c, "VALIDATION_ERROR", "\uC81C\uBAA9\uACFC \uC774\uBBF8\uC9C0\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694.");
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const uuid = crypto.randomUUID();
    const key = `gallery/original/${uuid}.${ext}`;
    await c.env.BUCKET.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type }
    });
    const imageUrl = `/api/images/${key}`;
    const result = await c.env.DB.prepare(
      `INSERT INTO gallery (user_id, title, description, image_key, image_url)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(userId, title, description || "", key, imageUrl).run();
    return success(c, { id: result.meta.last_row_id, url: imageUrl });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
galleryRoutes.put("/:id", authMiddleware, async (c) => {
  try {
    const { userId, role } = c.get("user");
    const id = c.req.param("id");
    const body = await c.req.json();
    const { title, description } = body;
    const item = await c.env.DB.prepare(
      "SELECT user_id FROM gallery WHERE id = ? AND is_deleted = 0"
    ).bind(id).first();
    if (!item) {
      return notFound(c, "\uC774\uBBF8\uC9C0\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }
    if (item.user_id !== userId && role !== "master" && role !== "submaster") {
      return error(c, "FORBIDDEN", "\uC218\uC815 \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.", 403);
    }
    await c.env.DB.prepare(
      'UPDATE gallery SET title = ?, description = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(title, description || "", id).run();
    return success(c, { message: "\uC218\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
galleryRoutes.delete("/:id", authMiddleware, async (c) => {
  try {
    const { userId, role } = c.get("user");
    const id = c.req.param("id");
    const item = await c.env.DB.prepare(
      "SELECT user_id, image_key FROM gallery WHERE id = ? AND is_deleted = 0"
    ).bind(id).first();
    if (!item) {
      return notFound(c, "\uC774\uBBF8\uC9C0\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }
    if (item.user_id !== userId && role !== "master" && role !== "submaster") {
      return error(c, "FORBIDDEN", "\uC0AD\uC81C \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.", 403);
    }
    if (c.env.BUCKET) {
      try {
        await c.env.BUCKET.delete(item.image_key);
      } catch {
      }
    }
    await c.env.DB.prepare(
      'UPDATE gallery SET is_deleted = 1, updated_at = datetime("now") WHERE id = ?'
    ).bind(id).run();
    return success(c, { message: "\uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
galleryRoutes.post("/:id/like", authMiddleware, async (c) => {
  try {
    const { userId } = c.get("user");
    const id = c.req.param("id");
    const existing = await c.env.DB.prepare(
      "SELECT id FROM gallery_likes WHERE gallery_id = ? AND user_id = ?"
    ).bind(id, userId).first();
    if (existing) {
      await c.env.DB.prepare(
        "DELETE FROM gallery_likes WHERE gallery_id = ? AND user_id = ?"
      ).bind(id, userId).run();
      await c.env.DB.prepare(
        "UPDATE gallery SET like_count = like_count - 1 WHERE id = ?"
      ).bind(id).run();
      return success(c, { liked: false });
    } else {
      await c.env.DB.prepare(
        "INSERT INTO gallery_likes (gallery_id, user_id) VALUES (?, ?)"
      ).bind(id, userId).run();
      await c.env.DB.prepare(
        "UPDATE gallery SET like_count = like_count + 1 WHERE id = ?"
      ).bind(id).run();
      return success(c, { liked: true });
    }
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});

// src/routes/attendance.ts
var attendanceRoutes = new Hono2();
function getTodayKST() {
  const now = /* @__PURE__ */ new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1e3);
  if (kst.getHours() < 5) {
    kst.setDate(kst.getDate() - 1);
  }
  return kst.toISOString().split("T")[0];
}
__name(getTodayKST, "getTodayKST");
function getYesterdayKST() {
  const now = /* @__PURE__ */ new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1e3);
  if (kst.getHours() < 5) {
    kst.setDate(kst.getDate() - 1);
  }
  kst.setDate(kst.getDate() - 1);
  return kst.toISOString().split("T")[0];
}
__name(getYesterdayKST, "getYesterdayKST");
function getCurrentYearMonthKST() {
  const now = /* @__PURE__ */ new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1e3);
  if (kst.getHours() < 5) {
    kst.setDate(kst.getDate() - 1);
  }
  return {
    year: kst.getFullYear(),
    month: kst.getMonth() + 1
  };
}
__name(getCurrentYearMonthKST, "getCurrentYearMonthKST");
attendanceRoutes.get("/", authMiddleware, async (c) => {
  try {
    const { userId } = c.get("user");
    const yearParam = c.req.query("year");
    const monthParam = c.req.query("month");
    const kstNow = getCurrentYearMonthKST();
    const year = yearParam ? parseInt(yearParam) : kstNow.year;
    const month = monthParam ? String(parseInt(monthParam)).padStart(2, "0") : String(kstNow.month).padStart(2, "0");
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-31`;
    const attendance = await c.env.DB.prepare(`
      SELECT * FROM attendance
      WHERE user_id = ? AND check_date >= ? AND check_date <= ?
      ORDER BY check_date ASC
    `).bind(userId, startDate, endDate).all();
    return success(c, attendance.results);
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
attendanceRoutes.post("/check", authMiddleware, async (c) => {
  try {
    const { userId } = c.get("user");
    const today = getTodayKST();
    const existing = await c.env.DB.prepare(
      "SELECT id FROM attendance WHERE user_id = ? AND check_date = ?"
    ).bind(userId, today).first();
    if (existing) {
      return error(c, "ALREADY_CHECKED", "\uC774\uBBF8 \uCD9C\uC11D\uCCB4\uD06C\uB97C \uC644\uB8CC\uD588\uC2B5\uB2C8\uB2E4.");
    }
    const yesterdayStr = getYesterdayKST();
    const yesterdayAttendance = await c.env.DB.prepare(
      "SELECT streak_count FROM attendance WHERE user_id = ? AND check_date = ?"
    ).bind(userId, yesterdayStr).first();
    const streakCount = yesterdayAttendance ? yesterdayAttendance.streak_count + 1 : 1;
    await c.env.DB.prepare(
      "INSERT INTO attendance (user_id, check_date, streak_count) VALUES (?, ?, ?)"
    ).bind(userId, today, streakCount).run();
    const stats = await c.env.DB.prepare(
      "SELECT * FROM attendance_stats WHERE user_id = ?"
    ).bind(userId).first();
    if (stats) {
      const newMaxStreak = Math.max(stats.max_streak, streakCount);
      await c.env.DB.prepare(`
        UPDATE attendance_stats
        SET total_checks = total_checks + 1,
            current_streak = ?,
            max_streak = ?,
            last_check_date = ?
        WHERE user_id = ?
      `).bind(streakCount, newMaxStreak, today, userId).run();
    } else {
      await c.env.DB.prepare(`
        INSERT INTO attendance_stats (user_id, total_checks, current_streak, max_streak, last_check_date)
        VALUES (?, 1, ?, ?, ?)
      `).bind(userId, streakCount, streakCount, today).run();
    }
    return success(c, {
      message: "\uCD9C\uC11D\uCCB4\uD06C \uC644\uB8CC!",
      streak: streakCount
    });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
attendanceRoutes.get("/stats", authMiddleware, async (c) => {
  try {
    const { userId } = c.get("user");
    const stats = await c.env.DB.prepare(
      "SELECT * FROM attendance_stats WHERE user_id = ?"
    ).bind(userId).first();
    if (!stats) {
      return success(c, {
        total_checks: 0,
        current_streak: 0,
        max_streak: 0,
        last_check_date: null
      });
    }
    return success(c, stats);
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
attendanceRoutes.get("/ranking", async (c) => {
  try {
    const ranking = await c.env.DB.prepare(`
      SELECT s.*, u.character_name, u.profile_image, u.default_icon, u.profile_zoom
      FROM attendance_stats s
      LEFT JOIN users u ON s.user_id = u.id
      ORDER BY s.total_checks DESC
      LIMIT 10
    `).all();
    const rankingWithUser = ranking.results.map((r, i) => ({
      rank: i + 1,
      character_name: r.character_name,
      profile_image: r.profile_image,
      default_icon: r.default_icon,
      profile_zoom: r.profile_zoom,
      total_checks: r.total_checks,
      current_streak: r.current_streak,
      max_streak: r.max_streak
    }));
    return success(c, rankingWithUser);
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
attendanceRoutes.get("/benefits", async (c) => {
  try {
    const yearParam = c.req.query("year");
    const monthParam = c.req.query("month");
    const kstNow = getCurrentYearMonthKST();
    const year = yearParam ? parseInt(yearParam) : kstNow.year;
    const month = monthParam ? parseInt(monthParam) : kstNow.month;
    const benefits = await c.env.DB.prepare(`
      SELECT * FROM attendance_benefits WHERE year = ? AND month = ?
    `).bind(year, month).first();
    return success(c, benefits || {
      year,
      month,
      reward_5: "",
      reward_10: "",
      reward_15: "",
      reward_20: "",
      reward_full: ""
    });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
attendanceRoutes.post("/benefits", authMiddleware, requireRole("master", "submaster"), async (c) => {
  try {
    const body = await c.req.json();
    const { year, month, reward_5, reward_10, reward_15, reward_20, reward_full } = body;
    if (!year || !month) {
      return error(c, "VALIDATION_ERROR", "\uB144\uB3C4\uC640 \uC6D4\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.");
    }
    const existing = await c.env.DB.prepare(
      "SELECT id FROM attendance_benefits WHERE year = ? AND month = ?"
    ).bind(year, month).first();
    if (existing) {
      await c.env.DB.prepare(`
        UPDATE attendance_benefits
        SET reward_5 = ?, reward_10 = ?, reward_15 = ?, reward_20 = ?, reward_full = ?, updated_at = datetime('now')
        WHERE year = ? AND month = ?
      `).bind(reward_5 || "", reward_10 || "", reward_15 || "", reward_20 || "", reward_full || "", year, month).run();
    } else {
      await c.env.DB.prepare(`
        INSERT INTO attendance_benefits (year, month, reward_5, reward_10, reward_15, reward_20, reward_full)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(year, month, reward_5 || "", reward_10 || "", reward_15 || "", reward_20 || "", reward_full || "").run();
    }
    return success(c, { message: "\uD61C\uD0DD\uC774 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
attendanceRoutes.get("/admin/users", authMiddleware, requireRole("master", "submaster"), async (c) => {
  try {
    const yearParam = c.req.query("year");
    const monthParam = c.req.query("month");
    const kstNow = getCurrentYearMonthKST();
    const year = yearParam ? parseInt(yearParam) : kstNow.year;
    const month = monthParam ? String(parseInt(monthParam)).padStart(2, "0") : String(kstNow.month).padStart(2, "0");
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-31`;
    const users = await c.env.DB.prepare(`
      SELECT
        u.id, u.character_name, u.profile_image, u.default_icon, u.profile_zoom,
        COALESCE(s.total_checks, 0) as total_checks,
        COALESCE(s.current_streak, 0) as current_streak,
        COALESCE(s.max_streak, 0) as max_streak,
        s.last_check_date,
        (SELECT COUNT(*) FROM attendance a WHERE a.user_id = u.id AND a.check_date >= ? AND a.check_date <= ?) as month_count
      FROM users u
      LEFT JOIN attendance_stats s ON u.id = s.user_id
      WHERE u.is_approved = 1
      ORDER BY month_count DESC, u.character_name ASC
    `).bind(startDate, endDate).all();
    const result = await Promise.all(users.results.map(async (user) => {
      const dates = await c.env.DB.prepare(`
        SELECT check_date FROM attendance
        WHERE user_id = ? AND check_date >= ? AND check_date <= ?
        ORDER BY check_date ASC
      `).bind(user.id, startDate, endDate).all();
      return {
        ...user,
        attendance_dates: dates.results.map((d) => d.check_date)
      };
    }));
    return success(c, result);
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});

// src/routes/members.ts
var memberRoutes = new Hono2();
memberRoutes.get("/", async (c) => {
  try {
    const online = c.req.query("online");
    const role = c.req.query("role");
    const allianceId = c.req.query("alliance_id");
    const pending = c.req.query("pending");
    const limit = parseInt(c.req.query("limit") || "100");
    if (pending === "true") {
      const pendingUsers = await c.env.DB.prepare(`
        SELECT u.id, u.character_name, u.job, u.level, u.discord, u.profile_image, u.default_icon, u.profile_zoom,
               u.alliance_id, u.role, u.created_at,
               a.name as alliance_name, a.emblem as alliance_emblem, a.is_main as is_main_guild
        FROM users u
        LEFT JOIN alliances a ON u.alliance_id = a.id
        WHERE u.is_approved = 0
        ORDER BY u.created_at DESC
      `).all();
      return success(c, pendingUsers.results);
    }
    let query = `
      SELECT
        u.id, u.character_name, u.job, u.level, u.profile_image, u.default_icon, u.profile_zoom, u.role,
        u.alliance_id, u.last_login_at, u.created_at,
        a.name as alliance_name, a.emblem as alliance_emblem, a.is_main as is_main_guild,
        CASE
          WHEN u.last_login_at IS NOT NULL AND datetime(u.last_login_at) > datetime('now', '-12 hours')
          THEN 1
          ELSE 0
        END as is_online
      FROM users u
      LEFT JOIN alliances a ON u.alliance_id = a.id
      WHERE u.is_approved = 1
    `;
    const params = [];
    if (online === "true") {
      query += ' AND u.last_login_at IS NOT NULL AND datetime(u.last_login_at) > datetime("now", "-12 hours")';
    }
    if (role) {
      query += " AND u.role = ?";
      params.push(role);
    }
    if (allianceId) {
      query += " AND u.alliance_id = ?";
      params.push(parseInt(allianceId));
    }
    query += ' ORDER BY u.role = "master" DESC, u.role = "submaster" DESC, a.is_main DESC, u.level DESC LIMIT ?';
    params.push(limit);
    const members = await c.env.DB.prepare(query).bind(...params).all();
    return success(c, members.results);
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
memberRoutes.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const member = await c.env.DB.prepare(`
      SELECT
        u.id, u.character_name, u.job, u.level, u.discord, u.profile_image, u.default_icon, u.profile_zoom, u.role,
        u.alliance_id, u.last_login_at, u.created_at,
        a.name as alliance_name, a.emblem as alliance_emblem, a.is_main as is_main_guild,
        CASE
          WHEN u.last_login_at IS NOT NULL AND datetime(u.last_login_at) > datetime('now', '-12 hours')
          THEN 1
          ELSE 0
        END as is_online
      FROM users u
      LEFT JOIN alliances a ON u.alliance_id = a.id
      WHERE u.id = ? AND u.is_approved = 1
    `).bind(id).first();
    if (!member) {
      return notFound(c, "\uBA64\uBC84\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }
    return success(c, member);
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
memberRoutes.put("/:id/profile", authMiddleware, requireRole("master", "submaster"), async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { job, level } = body;
    const member = await c.env.DB.prepare(
      "SELECT id FROM users WHERE id = ?"
    ).bind(id).first();
    if (!member) {
      return notFound(c, "\uBA64\uBC84\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }
    const levelNum = parseInt(level);
    if (isNaN(levelNum) || levelNum < 1 || levelNum > 300) {
      return error(c, "VALIDATION_ERROR", "\uB808\uBCA8\uC740 1~300 \uC0AC\uC774\uC5EC\uC57C \uD569\uB2C8\uB2E4.");
    }
    await c.env.DB.prepare(
      'UPDATE users SET job = ?, level = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(job || "", levelNum, id).run();
    return success(c, { message: "\uD504\uB85C\uD544\uC774 \uC218\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
memberRoutes.put("/:id/role", authMiddleware, requireRole("master", "submaster"), async (c) => {
  try {
    const { role: myRole } = c.get("user");
    const id = c.req.param("id");
    const body = await c.req.json();
    const { role } = body;
    const validRoles = ["member", "submaster", "master", "honorary"];
    if (!validRoles.includes(role)) {
      return error(c, "VALIDATION_ERROR", "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC5ED\uD560\uC785\uB2C8\uB2E4.");
    }
    if (myRole === "submaster" && role === "master") {
      return error(c, "FORBIDDEN", "\uB9C8\uC2A4\uD130 \uC5ED\uD560\uC740 \uAE38\uB4DC \uB9C8\uC2A4\uD130\uB9CC \uBD80\uC5EC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.", 403);
    }
    const member = await c.env.DB.prepare(
      "SELECT id, role FROM users WHERE id = ?"
    ).bind(id).first();
    if (!member) {
      return notFound(c, "\uBA64\uBC84\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }
    if (myRole === "submaster" && member.role === "master") {
      return error(c, "FORBIDDEN", "\uB9C8\uC2A4\uD130\uC758 \uC5ED\uD560\uC740 \uBCC0\uACBD\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", 403);
    }
    await c.env.DB.prepare(
      'UPDATE users SET role = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(role, id).run();
    return success(c, { message: "\uC5ED\uD560\uC774 \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
memberRoutes.delete("/:id", authMiddleware, requireRole("master", "submaster"), async (c) => {
  try {
    const { role: myRole, userId: myId } = c.get("user");
    const id = c.req.param("id");
    const member = await c.env.DB.prepare(
      "SELECT id, role FROM users WHERE id = ?"
    ).bind(id).first();
    if (!member) {
      return notFound(c, "\uBA64\uBC84\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }
    if (Number(id) === myId) {
      return error(c, "FORBIDDEN", "\uBCF8\uC778 \uACC4\uC815\uC740 \uC0AD\uC81C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", 403);
    }
    if (member.role === "master") {
      return error(c, "FORBIDDEN", "\uB9C8\uC2A4\uD130\uB294 \uC0AD\uC81C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", 403);
    }
    if (myRole === "submaster" && member.role === "submaster") {
      return error(c, "FORBIDDEN", "\uBD80\uB9C8\uC2A4\uD130\uB294 \uB2E4\uB978 \uBD80\uB9C8\uC2A4\uD130\uB97C \uC0AD\uC81C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", 403);
    }
    await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
    return success(c, { message: "\uBA64\uBC84\uAC00 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
memberRoutes.put("/:id/approve", authMiddleware, requireRole("master", "submaster"), async (c) => {
  try {
    const id = c.req.param("id");
    const member = await c.env.DB.prepare(
      "SELECT id, is_approved FROM users WHERE id = ?"
    ).bind(id).first();
    if (!member) {
      return notFound(c, "\uBA64\uBC84\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }
    if (member.is_approved) {
      return error(c, "ALREADY_APPROVED", "\uC774\uBBF8 \uC2B9\uC778\uB41C \uBA64\uBC84\uC785\uB2C8\uB2E4.");
    }
    await c.env.DB.prepare(
      'UPDATE users SET is_approved = 1, updated_at = datetime("now") WHERE id = ?'
    ).bind(id).run();
    return success(c, { message: "\uAC00\uC785\uC774 \uC2B9\uC778\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
memberRoutes.get("/pending/list", authMiddleware, requireRole("master", "submaster"), async (c) => {
  try {
    const pending = await c.env.DB.prepare(`
      SELECT u.id, u.character_name, u.job, u.level, u.discord, u.profile_image, u.default_icon, u.profile_zoom,
             u.alliance_id, u.role, u.created_at,
             a.name as alliance_name, a.emblem as alliance_emblem, a.is_main as is_main_guild
      FROM users u
      LEFT JOIN alliances a ON u.alliance_id = a.id
      WHERE u.is_approved = 0
      ORDER BY u.created_at DESC
    `).all();
    return success(c, pending.results);
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});

// src/routes/alliances.ts
var allianceRoutes = new Hono2();
allianceRoutes.get("/", async (c) => {
  try {
    const alliances = await c.env.DB.prepare(`
      SELECT * FROM alliances
      ORDER BY is_main DESC, sort_order ASC
    `).all();
    return success(c, alliances.results);
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
allianceRoutes.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const alliance = await c.env.DB.prepare(
      "SELECT * FROM alliances WHERE id = ?"
    ).bind(id).first();
    if (!alliance) {
      return error(c, "NOT_FOUND", "\uAE38\uB4DC\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", 404);
    }
    return success(c, alliance);
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
allianceRoutes.post("/", authMiddleware, requireRole("master", "submaster"), async (c) => {
  try {
    const body = await c.req.json();
    const { guild_name, guild_master, member_count, guild_level, description, is_main } = body;
    if (!guild_name) {
      return error(c, "VALIDATION_ERROR", "\uAE38\uB4DC \uC774\uB984\uC740 \uD544\uC218\uC785\uB2C8\uB2E4.");
    }
    const maxOrder = await c.env.DB.prepare("SELECT MAX(sort_order) as max FROM alliances").first();
    const sortOrder = (maxOrder?.max || 0) + 1;
    const result = await c.env.DB.prepare(`
      INSERT INTO alliances (name, master_name, member_count, guild_level, description, is_main, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      guild_name,
      guild_master || "",
      member_count || 0,
      guild_level || 1,
      description || "",
      is_main ? 1 : 0,
      sortOrder
    ).run();
    return success(c, { id: result.meta.last_row_id, message: "\uC5F0\uD569 \uAE38\uB4DC\uAC00 \uCD94\uAC00\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
allianceRoutes.put("/:id", authMiddleware, requireRole("master", "submaster"), async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { guild_name, guild_master, member_count, guild_level, description, is_main } = body;
    const alliance = await c.env.DB.prepare("SELECT id FROM alliances WHERE id = ?").bind(id).first();
    if (!alliance) {
      return notFound(c, "\uAE38\uB4DC\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }
    await c.env.DB.prepare(`
      UPDATE alliances SET name = ?, master_name = ?, member_count = ?, guild_level = ?, description = ?, is_main = ?
      WHERE id = ?
    `).bind(
      guild_name,
      guild_master || "",
      member_count || 0,
      guild_level || 1,
      description || "",
      is_main ? 1 : 0,
      id
    ).run();
    return success(c, { message: "\uC5F0\uD569 \uAE38\uB4DC\uAC00 \uC218\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
allianceRoutes.delete("/:id", authMiddleware, requireRole("master", "submaster"), async (c) => {
  try {
    const id = c.req.param("id");
    const alliance = await c.env.DB.prepare("SELECT id, is_main FROM alliances WHERE id = ?").bind(id).first();
    if (!alliance) {
      return notFound(c, "\uAE38\uB4DC\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }
    if (alliance.is_main) {
      return error(c, "CANNOT_DELETE_MAIN", "\uBA54\uC778 \uAE38\uB4DC\uB294 \uC0AD\uC81C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }
    await c.env.DB.prepare("DELETE FROM alliances WHERE id = ?").bind(id).run();
    return success(c, { message: "\uC5F0\uD569 \uAE38\uB4DC\uAC00 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});

// src/routes/events.ts
var eventRoutes = new Hono2();
eventRoutes.get("/", async (c) => {
  try {
    const now = /* @__PURE__ */ new Date();
    const koreaTime = new Date(now.getTime() + 9 * 60 * 60 * 1e3);
    const today = koreaTime.toISOString().split("T")[0];
    const events = await c.env.DB.prepare(`
      SELECT * FROM events
      WHERE is_active = 1 AND event_date >= ?
      ORDER BY event_date ASC, event_time ASC
    `).bind(today).all();
    return success(c, events.results);
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
eventRoutes.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const event = await c.env.DB.prepare(
      "SELECT * FROM events WHERE id = ?"
    ).bind(id).first();
    if (!event) {
      return notFound(c, "\uC774\uBCA4\uD2B8\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }
    const participants = await c.env.DB.prepare(`
      SELECT ep.*, u.character_name, u.job, u.level
      FROM event_participants ep
      LEFT JOIN users u ON ep.user_id = u.id
      WHERE ep.event_id = ?
    `).bind(id).all();
    return success(c, {
      ...event,
      participants: participants.results.map((p) => ({
        id: p.id,
        user_id: p.user_id,
        character_name: p.character_name,
        job: p.job,
        level: p.level,
        status: p.status
      }))
    });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
eventRoutes.post("/:id/join", authMiddleware, async (c) => {
  try {
    const { userId } = c.get("user");
    const id = c.req.param("id");
    const event = await c.env.DB.prepare(
      "SELECT * FROM events WHERE id = ? AND is_active = 1"
    ).bind(id).first();
    if (!event) {
      return notFound(c, "\uC774\uBCA4\uD2B8\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }
    const existing = await c.env.DB.prepare(
      "SELECT id FROM event_participants WHERE event_id = ? AND user_id = ?"
    ).bind(id, userId).first();
    if (existing) {
      await c.env.DB.prepare(
        "DELETE FROM event_participants WHERE event_id = ? AND user_id = ?"
      ).bind(id, userId).run();
      await c.env.DB.prepare(
        "UPDATE events SET current_participants = current_participants - 1 WHERE id = ?"
      ).bind(id).run();
      return success(c, { joined: false, message: "\uCC38\uAC00\uAC00 \uCDE8\uC18C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
    }
    if (event.max_participants && event.current_participants >= event.max_participants) {
      return error(c, "FULL", "\uC815\uC6D0\uC774 \uAC00\uB4DD \uCC3C\uC2B5\uB2C8\uB2E4.");
    }
    await c.env.DB.prepare(
      'INSERT INTO event_participants (event_id, user_id, status) VALUES (?, ?, "confirmed")'
    ).bind(id, userId).run();
    await c.env.DB.prepare(
      "UPDATE events SET current_participants = current_participants + 1 WHERE id = ?"
    ).bind(id).run();
    return success(c, { joined: true, message: "\uCC38\uAC00 \uC2E0\uCCAD\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4!" });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
eventRoutes.post("/", authMiddleware, requireRole("master", "submaster"), async (c) => {
  try {
    const body = await c.req.json();
    const { title, description, event_date, event_time, event_type, max_participants } = body;
    if (!title || !event_date) {
      return error(c, "VALIDATION_ERROR", "\uC81C\uBAA9\uACFC \uB0A0\uC9DC\uB294 \uD544\uC218\uC785\uB2C8\uB2E4.");
    }
    const result = await c.env.DB.prepare(`
      INSERT INTO events (title, description, event_date, event_time, event_type, max_participants, current_participants, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 0, 1)
    `).bind(
      title,
      description || "",
      event_date,
      event_time || "20:00",
      event_type || "event",
      max_participants || null
    ).run();
    return success(c, { id: result.meta.last_row_id, message: "\uC77C\uC815\uC774 \uB4F1\uB85D\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
eventRoutes.put("/:id", authMiddleware, requireRole("master", "submaster"), async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { title, description, event_date, event_time, event_type, max_participants, is_active } = body;
    const event = await c.env.DB.prepare("SELECT id FROM events WHERE id = ?").bind(id).first();
    if (!event) {
      return notFound(c, "\uC774\uBCA4\uD2B8\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }
    await c.env.DB.prepare(`
      UPDATE events SET title = ?, description = ?, event_date = ?, event_time = ?, event_type = ?, max_participants = ?, is_active = ?, updated_at = datetime("now")
      WHERE id = ?
    `).bind(
      title,
      description || "",
      event_date,
      event_time || "20:00",
      event_type || "event",
      max_participants || null,
      is_active !== void 0 ? is_active ? 1 : 0 : 1,
      id
    ).run();
    return success(c, { message: "\uC77C\uC815\uC774 \uC218\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
eventRoutes.delete("/:id", authMiddleware, requireRole("master", "submaster"), async (c) => {
  try {
    const id = c.req.param("id");
    const event = await c.env.DB.prepare("SELECT id FROM events WHERE id = ?").bind(id).first();
    if (!event) {
      return notFound(c, "\uC774\uBCA4\uD2B8\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }
    await c.env.DB.prepare("DELETE FROM event_participants WHERE event_id = ?").bind(id).run();
    await c.env.DB.prepare("DELETE FROM events WHERE id = ?").bind(id).run();
    return success(c, { message: "\uC77C\uC815\uC774 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
eventRoutes.get("/:id/participants", async (c) => {
  try {
    const id = c.req.param("id");
    const participants = await c.env.DB.prepare(`
      SELECT ep.*, u.character_name, u.job, u.level, u.profile_image, u.default_icon, u.profile_zoom
      FROM event_participants ep
      LEFT JOIN users u ON ep.user_id = u.id
      WHERE ep.event_id = ?
      ORDER BY ep.created_at ASC
    `).bind(id).all();
    return success(c, participants.results.map((p) => ({
      id: p.id,
      user_id: p.user_id,
      character_name: p.character_name,
      job: p.job,
      level: p.level,
      profile_image: p.profile_image,
      default_icon: p.default_icon,
      profile_zoom: p.profile_zoom,
      status: p.status
    })));
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});

// src/routes/notices.ts
var noticeRoutes = new Hono2();
noticeRoutes.get("/", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "50");
    const notices = await c.env.DB.prepare(`
      SELECT n.*, u.character_name, u.profile_image, u.default_icon, u.profile_zoom
      FROM notices n
      LEFT JOIN users u ON n.user_id = u.id
      WHERE n.is_active = 1
      ORDER BY n.is_important DESC, n.created_at DESC
      LIMIT ?
    `).bind(limit).all();
    const result = notices.results.map((n) => ({
      ...n,
      user: n.character_name ? {
        character_name: n.character_name,
        profile_image: n.profile_image,
        default_icon: n.default_icon,
        profile_zoom: n.profile_zoom
      } : null
    }));
    return success(c, result);
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
noticeRoutes.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const notice = await c.env.DB.prepare(`
      SELECT n.*, u.character_name, u.profile_image, u.default_icon, u.profile_zoom
      FROM notices n
      LEFT JOIN users u ON n.user_id = u.id
      WHERE n.id = ? AND n.is_active = 1
    `).bind(id).first();
    if (!notice) {
      return error(c, "NOT_FOUND", "\uACF5\uC9C0\uC0AC\uD56D\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", 404);
    }
    const result = { ...notice };
    if (notice.character_name) {
      result.user = {
        character_name: notice.character_name,
        profile_image: notice.profile_image
      };
    }
    return success(c, result);
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
noticeRoutes.post("/", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    if (user.role !== "master" && user.role !== "submaster") {
      return error(c, "FORBIDDEN", "\uACF5\uC9C0\uC0AC\uD56D \uC791\uC131 \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.", 403);
    }
    const body = await c.req.json();
    const { title, content, is_important } = body;
    if (!title?.trim() || !content?.trim()) {
      return error(c, "VALIDATION_ERROR", "\uC81C\uBAA9\uACFC \uB0B4\uC6A9\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.", 400);
    }
    const result = await c.env.DB.prepare(`
      INSERT INTO notices (user_id, title, content, is_important, is_active, created_at)
      VALUES (?, ?, ?, ?, 1, datetime('now'))
    `).bind(user.userId, title.trim(), content.trim(), is_important ? 1 : 0).run();
    return success(c, { id: result.meta.last_row_id });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
noticeRoutes.put("/:id", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");
    if (user.role !== "master" && user.role !== "submaster") {
      return error(c, "FORBIDDEN", "\uACF5\uC9C0\uC0AC\uD56D \uC218\uC815 \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.", 403);
    }
    const body = await c.req.json();
    const { title, content, is_important } = body;
    if (!title?.trim() || !content?.trim()) {
      return error(c, "VALIDATION_ERROR", "\uC81C\uBAA9\uACFC \uB0B4\uC6A9\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.", 400);
    }
    await c.env.DB.prepare(`
      UPDATE notices
      SET title = ?, content = ?, is_important = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(title.trim(), content.trim(), is_important ? 1 : 0, id).run();
    return success(c, { id });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
noticeRoutes.delete("/:id", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");
    if (user.role !== "master" && user.role !== "submaster") {
      return error(c, "FORBIDDEN", "\uACF5\uC9C0\uC0AC\uD56D \uC0AD\uC81C \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.", 403);
    }
    await c.env.DB.prepare(`
      UPDATE notices SET is_active = 0 WHERE id = ?
    `).bind(id).run();
    return success(c, { deleted: true });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});

// src/routes/games.ts
var gameRoutes = new Hono2();
gameRoutes.post("/scores", authMiddleware, async (c) => {
  try {
    const { userId, username } = c.get("user");
    const body = await c.req.json();
    const { game_type, score, metadata } = body;
    const validGames = ["reaction", "memory", "typing", "number", "game2048", "aimtrainer", "colortest", "snake", "flappy", "pattern"];
    if (!validGames.includes(game_type)) {
      return error(c, "VALIDATION_ERROR", "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uAC8C\uC784\uC785\uB2C8\uB2E4.");
    }
    const user = await c.env.DB.prepare(
      "SELECT character_name FROM users WHERE id = ?"
    ).bind(userId).first();
    const existing = await c.env.DB.prepare(`
      SELECT id, score FROM game_scores
      WHERE user_id = ? AND game_type = ?
    `).bind(userId, game_type).first();
    const lowerIsBetter = ["reaction", "number"].includes(game_type);
    let isNewRecord = false;
    if (!existing) {
      await c.env.DB.prepare(`
        INSERT INTO game_scores (user_id, game_type, score, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(userId, game_type, score, JSON.stringify(metadata || {})).run();
      isNewRecord = true;
    } else {
      const isBetter = lowerIsBetter ? score < existing.score : score > existing.score;
      if (isBetter) {
        await c.env.DB.prepare(`
          UPDATE game_scores SET score = ?, metadata = ?, updated_at = datetime('now')
          WHERE id = ?
        `).bind(score, JSON.stringify(metadata || {}), existing.id).run();
        isNewRecord = true;
      }
    }
    const rankQuery = lowerIsBetter ? "SELECT COUNT(*) + 1 as rank FROM game_scores WHERE game_type = ? AND score < ?" : "SELECT COUNT(*) + 1 as rank FROM game_scores WHERE game_type = ? AND score > ?";
    const rankResult = await c.env.DB.prepare(rankQuery).bind(game_type, score).first();
    return success(c, {
      isNewRecord,
      score,
      rank: rankResult?.rank || 1,
      character_name: user?.character_name
    });
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
gameRoutes.get("/rankings/:gameType", async (c) => {
  try {
    const gameType = c.req.param("gameType");
    const limit = parseInt(c.req.query("limit") || "10");
    const validGames = ["reaction", "memory", "typing", "number", "game2048", "aimtrainer", "colortest", "snake", "flappy", "pattern"];
    if (!validGames.includes(gameType)) {
      return error(c, "VALIDATION_ERROR", "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uAC8C\uC784\uC785\uB2C8\uB2E4.");
    }
    const lowerIsBetter = ["reaction", "number"].includes(gameType);
    const orderBy = lowerIsBetter ? "ASC" : "DESC";
    const rankings = await c.env.DB.prepare(`
      SELECT gs.id, gs.score, gs.metadata, gs.updated_at,
             u.id as user_id, u.character_name, u.profile_image, u.default_icon, u.profile_zoom
      FROM game_scores gs
      JOIN users u ON gs.user_id = u.id
      WHERE gs.game_type = ?
      ORDER BY gs.score ${orderBy}
      LIMIT ?
    `).bind(gameType, limit).all();
    return success(c, rankings.results?.map((r, i) => ({
      rank: i + 1,
      score: r.score,
      metadata: JSON.parse(r.metadata || "{}"),
      updated_at: r.updated_at,
      user: {
        id: r.user_id,
        character_name: r.character_name,
        profile_image: r.profile_image,
        default_icon: r.default_icon,
        profile_zoom: r.profile_zoom
      }
    })));
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
gameRoutes.get("/my-scores", authMiddleware, async (c) => {
  try {
    const { userId } = c.get("user");
    const scores = await c.env.DB.prepare(`
      SELECT game_type, score, metadata, updated_at
      FROM game_scores
      WHERE user_id = ?
    `).bind(userId).all();
    const result = {};
    for (const score of scores.results || []) {
      const s = score;
      const lowerIsBetter = ["reaction", "number"].includes(s.game_type);
      const rankQuery = lowerIsBetter ? "SELECT COUNT(*) + 1 as rank FROM game_scores WHERE game_type = ? AND score < ?" : "SELECT COUNT(*) + 1 as rank FROM game_scores WHERE game_type = ? AND score > ?";
      const rankResult = await c.env.DB.prepare(rankQuery).bind(s.game_type, s.score).first();
      result[s.game_type] = {
        score: s.score,
        metadata: JSON.parse(s.metadata || "{}"),
        rank: rankResult?.rank || 1,
        updated_at: s.updated_at
      };
    }
    return success(c, result);
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});
gameRoutes.get("/rankings", async (c) => {
  try {
    const games = ["reaction", "memory", "typing", "number", "game2048", "aimtrainer", "colortest", "snake", "flappy", "pattern"];
    const result = {};
    for (const game of games) {
      const lowerIsBetter = ["reaction", "number"].includes(game);
      const orderBy = lowerIsBetter ? "ASC" : "DESC";
      const top3 = await c.env.DB.prepare(`
        SELECT gs.score, u.character_name, u.profile_image, u.default_icon
        FROM game_scores gs
        JOIN users u ON gs.user_id = u.id
        WHERE gs.game_type = ?
        ORDER BY gs.score ${orderBy}
        LIMIT 3
      `).bind(game).all();
      result[game] = top3.results || [];
    }
    return success(c, result);
  } catch (e) {
    return error(c, "SERVER_ERROR", e.message, 500);
  }
});

// src/routes/scrolls.ts
var scrollRoutes = new Hono2();
scrollRoutes.get("/rankings", async (c) => {
  const limit = parseInt(c.req.query("limit") || "50");
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT
        sr.*,
        u.character_name,
        u.username
      FROM scroll_records sr
      JOIN users u ON sr.user_id = u.id
      ORDER BY sr.total_stat DESC, sr.success_count DESC, sr.created_at DESC
      LIMIT ?
    `).bind(limit).all();
    return c.json({ success: true, data: results });
  } catch (e) {
    console.error("Error fetching scroll rankings:", e);
    return c.json({ success: false, error: "Failed to fetch rankings" }, 500);
  }
});
scrollRoutes.delete("/rankings", authMiddleware, async (c) => {
  const user = c.get("user");
  if (user.role !== "master" && user.role !== "submaster") {
    return c.json({ success: false, error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 403);
  }
  try {
    await c.env.DB.prepare(`DELETE FROM scroll_records`).run();
    return c.json({ success: true, message: "\uC8FC\uBB38\uC11C \uB7AD\uD0B9\uC774 \uCD08\uAE30\uD654\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (e) {
    console.error("Error resetting scroll rankings:", e);
    return c.json({ success: false, error: "\uB7AD\uD0B9 \uCD08\uAE30\uD654\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4." }, 500);
  }
});
scrollRoutes.get("/my-records", authMiddleware, async (c) => {
  const user = c.get("user");
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT *
      FROM scroll_records
      WHERE user_id = ?
      ORDER BY total_stat DESC, created_at DESC
      LIMIT 20
    `).bind(user.userId).all();
    return c.json({ success: true, data: results });
  } catch (e) {
    console.error("Error fetching my scroll records:", e);
    return c.json({ success: false, error: "Failed to fetch records" }, 500);
  }
});
scrollRoutes.post("/records", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    if (!user || !user.userId) {
      return c.json({ success: false, error: "User not authenticated" }, 401);
    }
    const body = await c.req.json();
    const { item_id, item_name, success_count, fail_count, total_stat, stat_type } = body;
    if (!item_name || success_count === void 0 || total_stat === void 0) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }
    const existing = await c.env.DB.prepare(`
      SELECT id, total_stat FROM scroll_records
      WHERE user_id = ? AND item_id = ?
      ORDER BY total_stat DESC
      LIMIT 1
    `).bind(user.userId, item_id || 1).first();
    const isNewRecord = !existing || total_stat > existing.total_stat;
    if (isNewRecord) {
      if (existing) {
        await c.env.DB.prepare(`
          DELETE FROM scroll_records WHERE id = ?
        `).bind(existing.id).run();
      }
      await c.env.DB.prepare(`
        INSERT INTO scroll_records (user_id, item_id, item_name, success_count, fail_count, total_stat, stat_type)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        user.userId,
        item_id || 1,
        item_name,
        success_count || 0,
        fail_count || 0,
        total_stat || 0,
        stat_type || "atk"
      ).run();
    }
    return c.json({
      success: true,
      isNewRecord,
      message: isNewRecord ? "\uC0C8\uB85C\uC6B4 \uCD5C\uACE0 \uAE30\uB85D!" : "\uAE30\uC874 \uAE30\uB85D\uC774 \uB354 \uC88B\uC2B5\uB2C8\uB2E4."
    });
  } catch (e) {
    console.error("Error saving scroll record:", e?.message || e);
    return c.json({ success: false, error: `Failed to save record: ${e?.message || "Unknown error"}` }, 500);
  }
});

// src/routes/chaos.ts
var chaosRoutes = new Hono2();
chaosRoutes.delete("/rankings", authMiddleware, async (c) => {
  const user = c.get("user");
  if (user.role !== "master" && user.role !== "submaster") {
    return error(c, "FORBIDDEN", "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.", 403);
  }
  try {
    await c.env.DB.prepare(`DELETE FROM chaos_records`).run();
    return success(c, { message: "\uD63C\uC90C \uB7AD\uD0B9\uC774 \uCD08\uAE30\uD654\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (e) {
    console.error("Error resetting chaos rankings:", e);
    return error(c, "SERVER_ERROR", "\uB7AD\uD0B9 \uCD08\uAE30\uD654\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", 500);
  }
});
chaosRoutes.get("/rankings", async (c) => {
  const limit = parseInt(c.req.query("limit") || "20");
  const statType = c.req.query("stat_type") || "total";
  const upgradeCount = c.req.query("upgrade_count");
  try {
    let orderBy = "cr.total_stat DESC";
    if (statType === "atk") {
      orderBy = "cr.atk DESC";
    } else if (statType === "matk") {
      orderBy = "cr.matk DESC";
    }
    let whereClause = "1=1";
    const params = [];
    if (upgradeCount) {
      whereClause += " AND cr.upgrade_count = ?";
      params.push(parseInt(upgradeCount));
    }
    params.push(limit);
    const { results } = await c.env.DB.prepare(`
      SELECT
        cr.id,
        cr.user_id,
        cr.atk,
        cr.matk,
        cr.str,
        cr.dex,
        cr.int,
        cr.luk,
        cr.total_stat,
        cr.upgrade_count,
        cr.innocent_used,
        cr.chaos_success,
        cr.chaos_fail,
        cr.created_at,
        u.character_name
      FROM chaos_records cr
      JOIN users u ON cr.user_id = u.id
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ?
    `).bind(...params).all();
    return success(c, results);
  } catch (e) {
    console.error("Error fetching chaos rankings:", e);
    return error(c, "SERVER_ERROR", "\uB7AD\uD0B9\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", 500);
  }
});
chaosRoutes.post("/records", authMiddleware, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const { atk, matk, str, dex, int, luk, total_stat, upgrade_count, innocent_used, chaos_success, chaos_fail } = body;
  if (total_stat === void 0 || atk === void 0 || matk === void 0) {
    return error(c, "INVALID_INPUT", "\uD544\uC218 \uB370\uC774\uD130\uAC00 \uB204\uB77D\uB418\uC5C8\uC2B5\uB2C8\uB2E4.", 400);
  }
  const validUpgradeCounts = [5, 7, 9, 12];
  const finalUpgradeCount = validUpgradeCounts.includes(upgrade_count) ? upgrade_count : 5;
  try {
    await c.env.DB.prepare(`
      INSERT INTO chaos_records (user_id, atk, matk, str, dex, int, luk, total_stat, upgrade_count, innocent_used, chaos_success, chaos_fail)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      user.userId,
      atk,
      matk,
      str || 0,
      dex || 0,
      int || 0,
      luk || 0,
      total_stat,
      finalUpgradeCount,
      innocent_used || 0,
      chaos_success || 0,
      chaos_fail || 0
    ).run();
    return success(c, { message: "\uAE30\uB85D\uC774 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
  } catch (e) {
    console.error("Error saving chaos record:", e);
    return error(c, "SERVER_ERROR", "\uAE30\uB85D \uC800\uC7A5\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", 500);
  }
});

// src/routes/incubator.ts
var incubatorRoutes = new Hono2();
var COMPETITION_BOOST_RATES = {
  9: 1,
  // 이노센트
  23: 1,
  // 혼줌 60%
  139: 0.8,
  // 장공 10%
  49: 0.8,
  // 장공 60%
  140: 1,
  // 장공 100%
  134: 3.6,
  // 백줌 5%
  130: 3,
  // 백줌 10%
  117: 1.5
  // 백줌 20%
};
var getCompetitionBoostRate = /* @__PURE__ */ __name((id, baseRate) => {
  return COMPETITION_BOOST_RATES[id] ?? baseRate;
}, "getCompetitionBoostRate");
var COMPETITION_SCROLL_IDS = [9, 23, 49, 117, 130, 134, 139, 140];
async function getRandomItem(db, competitionBoost = false) {
  const { results: items } = await db.prepare(`
    SELECT id, name, rate, type, percent FROM incubator_items ORDER BY id
  `).all();
  if (!items || items.length === 0) {
    throw new Error("No items found in database");
  }
  const adjustedItems = items.map((item) => ({
    ...item,
    rate: competitionBoost && COMPETITION_SCROLL_IDS.includes(item.id) ? getCompetitionBoostRate(item.id, item.rate) : item.rate
  }));
  const totalRate = adjustedItems.reduce((sum, item) => sum + item.rate, 0);
  let random = Math.random() * totalRate;
  for (const item of adjustedItems) {
    random -= item.rate;
    if (random <= 0) {
      return items.find((i) => i.id === item.id);
    }
  }
  return items[items.length - 1];
}
__name(getRandomItem, "getRandomItem");
function getTodayKST2() {
  const now = /* @__PURE__ */ new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1e3);
  if (kst.getHours() < 5) {
    kst.setDate(kst.getDate() - 1);
  }
  return kst.toISOString().split("T")[0];
}
__name(getTodayKST2, "getTodayKST");
incubatorRoutes.get("/items", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT id, name, rate, type, percent FROM incubator_items ORDER BY rate ASC, id ASC
    `).all();
    return success(c, results);
  } catch (e) {
    console.error("Error fetching items:", e);
    return error(c, "SERVER_ERROR", "\uC544\uC774\uD15C \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", 500);
  }
});
incubatorRoutes.get("/inventory", authMiddleware, async (c) => {
  const user = c.get("user");
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT
        inv.item_id,
        inv.count,
        i.name,
        i.rate,
        i.type,
        i.percent
      FROM incubator_inventory inv
      JOIN incubator_items i ON inv.item_id = i.id
      WHERE inv.user_id = ?
      ORDER BY
        CASE
          WHEN i.id IN (9, 23, 49, 117, 130, 134, 139, 140) THEN 0
          ELSE 1
        END,
        CASE i.id
          WHEN 9 THEN 1    -- \uC774\uB178\uC13C\uD2B8
          WHEN 23 THEN 2   -- \uD63C\uC90C
          WHEN 139 THEN 3  -- \uC7A5\uACF5 10%
          WHEN 49 THEN 4   -- \uC7A5\uACF5 60%
          WHEN 140 THEN 5  -- \uC7A5\uACF5 100%
          WHEN 134 THEN 6  -- \uBC31\uC90C 5%
          WHEN 130 THEN 7  -- \uBC31\uC90C 10%
          WHEN 117 THEN 8  -- \uBC31\uC90C 20%
          ELSE 999
        END,
        i.rate ASC,
        i.id ASC
    `).bind(user.userId).all();
    return success(c, results);
  } catch (e) {
    console.error("Error fetching inventory:", e);
    return error(c, "SERVER_ERROR", "\uC778\uBCA4\uD1A0\uB9AC\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", 500);
  }
});
incubatorRoutes.get("/daily-stats", authMiddleware, async (c) => {
  const user = c.get("user");
  const today = getTodayKST2();
  try {
    const stats = await c.env.DB.prepare(`
      SELECT total_hatches, legendary_count
      FROM incubator_daily_stats
      WHERE user_id = ? AND hatch_date = ?
    `).bind(user.userId, today).first();
    const bonus = await c.env.DB.prepare(`
      SELECT bonus_hatches FROM incubator_bonus WHERE user_id = ?
    `).bind(user.userId).first();
    return success(c, {
      totalHatches: stats?.total_hatches || 0,
      legendaryCount: stats?.legendary_count || 0,
      bonusHatches: bonus?.bonus_hatches || 0,
      date: today
    });
  } catch (e) {
    console.error("Error fetching daily stats:", e);
    return error(c, "SERVER_ERROR", "\uD1B5\uACC4\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", 500);
  }
});
incubatorRoutes.post("/hatch", authMiddleware, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const count = Math.min(Math.max(parseInt(body.count) || 1, 1), 5);
  const competitionBoost = body.competitionBoost === true;
  const today = getTodayKST2();
  const DAILY_LIMIT = 3e3;
  try {
    const stats = await c.env.DB.prepare(`
      SELECT total_hatches FROM incubator_daily_stats
      WHERE user_id = ? AND hatch_date = ?
    `).bind(user.userId, today).first();
    const bonus = await c.env.DB.prepare(`
      SELECT bonus_hatches FROM incubator_bonus WHERE user_id = ?
    `).bind(user.userId).first();
    const currentHatches = stats?.total_hatches || 0;
    const bonusHatches = bonus?.bonus_hatches || 0;
    const totalLimit = DAILY_LIMIT + bonusHatches;
    const remaining = totalLimit - currentHatches;
    if (remaining <= 0) {
      return error(c, "DAILY_LIMIT", "\uC624\uB298 \uBD80\uD654 \uD69F\uC218\uB97C \uBAA8\uB450 \uC0AC\uC6A9\uD588\uC2B5\uB2C8\uB2E4.", 400);
    }
    const actualCount = Math.min(count, remaining);
    const results = [];
    let legendaryFound = 0;
    for (let i = 0; i < actualCount; i++) {
      const item = await getRandomItem(c.env.DB, competitionBoost);
      results.push(item);
      if (item.id === 1) {
        legendaryFound++;
      }
    }
    const inventoryCounts = {};
    for (const item of results) {
      inventoryCounts[item.id] = (inventoryCounts[item.id] || 0) + 1;
    }
    const statements = [];
    for (const [itemId, itemCount] of Object.entries(inventoryCounts)) {
      statements.push(
        c.env.DB.prepare(`
          INSERT INTO incubator_inventory (user_id, item_id, count)
          VALUES (?, ?, ?)
          ON CONFLICT(user_id, item_id) DO UPDATE SET
            count = count + ?,
            updated_at = datetime('now')
        `).bind(user.userId, parseInt(itemId), itemCount, itemCount)
      );
    }
    const lastItem = results[results.length - 1];
    statements.push(
      c.env.DB.prepare(`
        INSERT INTO incubator_history (user_id, item_id, hatch_count)
        VALUES (?, ?, ?)
      `).bind(user.userId, lastItem.id, actualCount)
    );
    statements.push(
      c.env.DB.prepare(`
        INSERT INTO incubator_daily_stats (user_id, hatch_date, total_hatches, legendary_count)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, hatch_date) DO UPDATE SET
          total_hatches = total_hatches + ?,
          legendary_count = legendary_count + ?
      `).bind(user.userId, today, actualCount, legendaryFound, actualCount, legendaryFound)
    );
    await c.env.DB.batch(statements);
    return success(c, {
      hatchedCount: actualCount,
      lastItem,
      allItems: results,
      // 모든 부화 결과
      legendaryFound,
      inventory: inventoryCounts,
      dailyTotal: currentHatches + actualCount
    });
  } catch (e) {
    console.error("Error hatching:", e);
    return error(c, "SERVER_ERROR", "\uBD80\uD654 \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.", 500);
  }
});
incubatorRoutes.get("/history", authMiddleware, async (c) => {
  const user = c.get("user");
  const limit = parseInt(c.req.query("limit") || "50");
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT
        h.id,
        h.item_id,
        h.hatch_count,
        h.created_at,
        i.name,
        i.rate,
        i.type
      FROM incubator_history h
      JOIN incubator_items i ON h.item_id = i.id
      WHERE h.user_id = ?
      ORDER BY h.created_at DESC
      LIMIT ?
    `).bind(user.userId, limit).all();
    return success(c, results);
  } catch (e) {
    console.error("Error fetching history:", e);
    return error(c, "SERVER_ERROR", "\uAE30\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", 500);
  }
});
incubatorRoutes.get("/scroll-inventory", authMiddleware, async (c) => {
  const user = c.get("user");
  const scrollItemIds = [9, 23, 49, 117, 130, 134, 139, 140];
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT
        inv.item_id,
        inv.count,
        i.name,
        i.percent
      FROM incubator_inventory inv
      JOIN incubator_items i ON inv.item_id = i.id
      WHERE inv.user_id = ? AND inv.item_id IN (${scrollItemIds.join(",")})
    `).bind(user.userId).all();
    const inventory = {};
    for (const item of results || []) {
      const i = item;
      if (i.item_id === 9)
        inventory.innocent = i.count;
      else if (i.item_id === 23)
        inventory.chaos60 = i.count;
      else if (i.item_id === 49)
        inventory.glove60 = i.count;
      else if (i.item_id === 117)
        inventory.white20 = i.count;
      else if (i.item_id === 130)
        inventory.white10 = i.count;
      else if (i.item_id === 134)
        inventory.white5 = i.count;
      else if (i.item_id === 139)
        inventory.glove10 = i.count;
      else if (i.item_id === 140)
        inventory.glove100 = i.count;
    }
    return success(c, {
      // 혼줌 시뮬용
      chaos60: inventory.chaos60 || 0,
      innocent: inventory.innocent || 0,
      white20: inventory.white20 || 0,
      white10: inventory.white10 || 0,
      white5: inventory.white5 || 0,
      // 노가다 목장갑용
      glove10: inventory.glove10 || 0,
      glove60: inventory.glove60 || 0,
      glove100: inventory.glove100 || 0
    });
  } catch (e) {
    console.error("Error fetching scroll inventory:", e);
    return error(c, "SERVER_ERROR", "\uC8FC\uBB38\uC11C \uC778\uBCA4\uD1A0\uB9AC\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", 500);
  }
});
incubatorRoutes.post("/use-scroll", authMiddleware, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const { scrollType, count = 1 } = body;
  const scrollItemMap = {
    // 혼줌 시뮬용
    chaos60: 23,
    // 혼돈의 주문서 60%
    innocent: 9,
    // 이노센트 주문서 100%
    white20: 117,
    // 백의 주문서 20%
    white10: 130,
    // 백의 주문서 10%
    white5: 134,
    // 백의 주문서 5%
    // 노가다 목장갑용
    glove10: 139,
    // 장갑 공격력 주문서 10%
    glove60: 49,
    // 장갑 공격력 주문서 60%
    glove100: 140
    // 장갑 공격력 주문서 100%
  };
  const itemId = scrollItemMap[scrollType];
  if (!itemId) {
    return error(c, "VALIDATION_ERROR", "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC8FC\uBB38\uC11C \uD0C0\uC785\uC785\uB2C8\uB2E4.", 400);
  }
  try {
    const inventory = await c.env.DB.prepare(`
      SELECT count FROM incubator_inventory
      WHERE user_id = ? AND item_id = ?
    `).bind(user.userId, itemId).first();
    const currentCount = inventory?.count || 0;
    if (currentCount < count) {
      return error(c, "INSUFFICIENT_ITEMS", `\uBCF4\uC720\uD55C \uC8FC\uBB38\uC11C\uAC00 \uBD80\uC871\uD569\uB2C8\uB2E4. (\uBCF4\uC720: ${currentCount}\uAC1C)`, 400);
    }
    if (currentCount === count) {
      await c.env.DB.prepare(`
        DELETE FROM incubator_inventory WHERE user_id = ? AND item_id = ?
      `).bind(user.userId, itemId).run();
    } else {
      await c.env.DB.prepare(`
        UPDATE incubator_inventory SET count = count - ?, updated_at = datetime('now')
        WHERE user_id = ? AND item_id = ?
      `).bind(count, user.userId, itemId).run();
    }
    return success(c, {
      used: count,
      remaining: currentCount - count,
      scrollType
    });
  } catch (e) {
    console.error("Error using scroll:", e);
    return error(c, "SERVER_ERROR", "\uC8FC\uBB38\uC11C \uC0AC\uC6A9\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", 500);
  }
});
incubatorRoutes.get("/competition/glove/rankings", async (c) => {
  const limit = parseInt(c.req.query("limit") || "20");
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT
        u.character_name,
        u.username,
        r.final_attack,
        r.upgrade_count,
        r.scroll_10_used,
        r.scroll_60_used,
        r.scroll_100_used,
        r.created_at
      FROM competition_glove_records r
      JOIN users u ON r.user_id = u.id
      ORDER BY r.final_attack DESC
      LIMIT ?
    `).bind(limit).all();
    return success(c, results || []);
  } catch (e) {
    console.error("Error fetching competition glove rankings:", e);
    return error(c, "SERVER_ERROR", "\uB7AD\uD0B9\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", 500);
  }
});
incubatorRoutes.post("/competition/glove/records", authMiddleware, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const { finalAttack, upgradeCount, scroll10Used, scroll60Used, scroll100Used } = body;
  try {
    const existing = await c.env.DB.prepare(`
      SELECT id, final_attack FROM competition_glove_records WHERE user_id = ?
    `).bind(user.userId).first();
    if (!existing || finalAttack > existing.final_attack) {
      if (existing) {
        await c.env.DB.prepare(`
          UPDATE competition_glove_records
          SET final_attack = ?, upgrade_count = ?, scroll_10_used = ?, scroll_60_used = ?, scroll_100_used = ?, created_at = datetime('now')
          WHERE user_id = ?
        `).bind(finalAttack, upgradeCount, scroll10Used || 0, scroll60Used || 0, scroll100Used || 0, user.userId).run();
      } else {
        await c.env.DB.prepare(`
          INSERT INTO competition_glove_records (user_id, final_attack, upgrade_count, scroll_10_used, scroll_60_used, scroll_100_used)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(user.userId, finalAttack, upgradeCount, scroll10Used || 0, scroll60Used || 0, scroll100Used || 0).run();
      }
      return success(c, { saved: true, newRecord: true });
    }
    return success(c, { saved: false, newRecord: false, message: "\uAE30\uC874 \uAE30\uB85D\uBCF4\uB2E4 \uB0AE\uC2B5\uB2C8\uB2E4." });
  } catch (e) {
    console.error("Error saving competition glove record:", e);
    return error(c, "SERVER_ERROR", "\uAE30\uB85D \uC800\uC7A5\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", 500);
  }
});
incubatorRoutes.get("/competition/chaos/rankings", async (c) => {
  const limit = parseInt(c.req.query("limit") || "20");
  const statType = c.req.query("stat_type") || "atk";
  try {
    const orderColumn = statType === "matk" ? "matk" : "atk";
    const { results } = await c.env.DB.prepare(`
      SELECT
        u.character_name,
        u.username,
        r.atk,
        r.matk,
        r.upgrade_count,
        r.chaos_used,
        r.innocent_used,
        r.white_used,
        r.created_at
      FROM competition_chaos_records r
      JOIN users u ON r.user_id = u.id
      ORDER BY r.${orderColumn} DESC
      LIMIT ?
    `).bind(limit).all();
    return success(c, results || []);
  } catch (e) {
    console.error("Error fetching competition chaos rankings:", e);
    return error(c, "SERVER_ERROR", "\uB7AD\uD0B9\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", 500);
  }
});
incubatorRoutes.post("/competition/chaos/records", authMiddleware, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const { atk, matk, upgradeCount, chaosUsed, innocentUsed, whiteUsed } = body;
  try {
    const existing = await c.env.DB.prepare(`
      SELECT id, atk, matk FROM competition_chaos_records WHERE user_id = ?
    `).bind(user.userId).first();
    const shouldUpdate = !existing || atk > existing.atk || matk > existing.matk;
    if (shouldUpdate) {
      if (existing) {
        const newAtk = Math.max(atk, existing.atk);
        const newMatk = Math.max(matk, existing.matk);
        await c.env.DB.prepare(`
          UPDATE competition_chaos_records
          SET atk = ?, matk = ?, upgrade_count = ?, chaos_used = ?, innocent_used = ?, white_used = ?, created_at = datetime('now')
          WHERE user_id = ?
        `).bind(newAtk, newMatk, upgradeCount, chaosUsed || 0, innocentUsed || 0, whiteUsed || 0, user.userId).run();
      } else {
        await c.env.DB.prepare(`
          INSERT INTO competition_chaos_records (user_id, atk, matk, upgrade_count, chaos_used, innocent_used, white_used)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(user.userId, atk, matk, upgradeCount, chaosUsed || 0, innocentUsed || 0, whiteUsed || 0).run();
      }
      return success(c, { saved: true, newRecord: true });
    }
    return success(c, { saved: false, newRecord: false, message: "\uAE30\uC874 \uAE30\uB85D\uBCF4\uB2E4 \uB0AE\uC2B5\uB2C8\uB2E4." });
  } catch (e) {
    console.error("Error saving competition chaos record:", e);
    return error(c, "SERVER_ERROR", "\uAE30\uB85D \uC800\uC7A5\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", 500);
  }
});
incubatorRoutes.get("/rankings", async (c) => {
  const limit = parseInt(c.req.query("limit") || "20");
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT
        u.character_name,
        u.username,
        inv.count as legendary_count
      FROM incubator_inventory inv
      JOIN users u ON inv.user_id = u.id
      WHERE inv.item_id = 1
      ORDER BY inv.count DESC
      LIMIT ?
    `).bind(limit).all();
    return success(c, results);
  } catch (e) {
    console.error("Error fetching rankings:", e);
    return error(c, "SERVER_ERROR", "\uB7AD\uD0B9\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", 500);
  }
});
incubatorRoutes.get("/admin/users", authMiddleware, async (c) => {
  const user = c.get("user");
  if (user.role !== "master" && user.role !== "submaster") {
    return error(c, "FORBIDDEN", "\uAD00\uB9AC\uC790\uB9CC \uC811\uADFC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.", 403);
  }
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT
        u.id,
        u.character_name,
        u.role,
        COALESCE(SUM(ds.total_hatches), 0) as total_hatches,
        COALESCE(SUM(ds.legendary_count), 0) as legendary_count,
        COALESCE(
          (SELECT count FROM incubator_inventory WHERE user_id = u.id AND item_id = 1),
          0
        ) as legendary_inventory,
        COALESCE(
          (SELECT bonus_hatches FROM incubator_bonus WHERE user_id = u.id),
          0
        ) as bonus_hatches
      FROM users u
      LEFT JOIN incubator_daily_stats ds ON u.id = ds.user_id
      WHERE u.is_approved = 1
      GROUP BY u.id
      ORDER BY total_hatches DESC
    `).all();
    return success(c, results);
  } catch (e) {
    console.error("Error fetching admin users:", e);
    return error(c, "SERVER_ERROR", "\uC720\uC800 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", 500);
  }
});
incubatorRoutes.get("/admin/users/:userId/inventory", authMiddleware, async (c) => {
  const user = c.get("user");
  const targetUserId = parseInt(c.req.param("userId"));
  if (user.role !== "master" && user.role !== "submaster") {
    return error(c, "FORBIDDEN", "\uAD00\uB9AC\uC790\uB9CC \uC811\uADFC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.", 403);
  }
  try {
    const targetUser = await c.env.DB.prepare(`
      SELECT id, character_name, role FROM users WHERE id = ?
    `).bind(targetUserId).first();
    if (!targetUser) {
      return error(c, "NOT_FOUND", "\uC720\uC800\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", 404);
    }
    const { results: inventory } = await c.env.DB.prepare(`
      SELECT
        inv.item_id,
        inv.count,
        i.name,
        i.rate,
        i.type,
        i.percent
      FROM incubator_inventory inv
      JOIN incubator_items i ON inv.item_id = i.id
      WHERE inv.user_id = ?
      ORDER BY i.rate ASC, i.id ASC
    `).bind(targetUserId).all();
    const today = getTodayKST2();
    const todayStats = await c.env.DB.prepare(`
      SELECT total_hatches, legendary_count
      FROM incubator_daily_stats
      WHERE user_id = ? AND hatch_date = ?
    `).bind(targetUserId, today).first();
    const bonus = await c.env.DB.prepare(`
      SELECT bonus_hatches FROM incubator_bonus WHERE user_id = ?
    `).bind(targetUserId).first();
    return success(c, {
      user: targetUser,
      inventory,
      todayStats: {
        totalHatches: todayStats?.total_hatches || 0,
        legendaryCount: todayStats?.legendary_count || 0
      },
      bonusHatches: bonus?.bonus_hatches || 0
    });
  } catch (e) {
    console.error("Error fetching user inventory:", e);
    return error(c, "SERVER_ERROR", "\uC778\uBCA4\uD1A0\uB9AC\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", 500);
  }
});
incubatorRoutes.post("/admin/users/:userId/bonus", authMiddleware, async (c) => {
  const user = c.get("user");
  const targetUserId = parseInt(c.req.param("userId"));
  if (user.role !== "master") {
    return error(c, "FORBIDDEN", "\uAE38\uB4DC \uB9C8\uC2A4\uD130\uB9CC \uBCF4\uB108\uC2A4\uB97C \uC9C0\uAE09\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.", 403);
  }
  const body = await c.req.json();
  const amount = parseInt(body.amount) || 0;
  if (amount <= 0 || amount > 1e4) {
    return error(c, "INVALID_INPUT", "\uC9C0\uAE09\uB7C9\uC740 1~10000 \uC0AC\uC774\uC5EC\uC57C \uD569\uB2C8\uB2E4.", 400);
  }
  try {
    await c.env.DB.prepare(`
      INSERT INTO incubator_bonus (user_id, bonus_hatches, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        bonus_hatches = bonus_hatches + ?,
        updated_at = datetime('now')
    `).bind(targetUserId, amount, amount).run();
    const bonus = await c.env.DB.prepare(`
      SELECT bonus_hatches FROM incubator_bonus WHERE user_id = ?
    `).bind(targetUserId).first();
    return success(c, {
      message: `${amount}\uD68C \uBCF4\uB108\uC2A4\uAC00 \uC9C0\uAE09\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`,
      totalBonus: bonus?.bonus_hatches || amount
    });
  } catch (e) {
    console.error("Error granting bonus:", e);
    return error(c, "SERVER_ERROR", "\uBCF4\uB108\uC2A4 \uC9C0\uAE09\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", 500);
  }
});
incubatorRoutes.post("/admin/users/:userId/revoke-bonus", authMiddleware, async (c) => {
  const user = c.get("user");
  const targetUserId = parseInt(c.req.param("userId"));
  if (user.role !== "master") {
    return error(c, "FORBIDDEN", "\uAE38\uB4DC \uB9C8\uC2A4\uD130\uB9CC \uBCF4\uB108\uC2A4\uB97C \uD68C\uC218\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.", 403);
  }
  try {
    const current = await c.env.DB.prepare(`
      SELECT bonus_hatches FROM incubator_bonus WHERE user_id = ?
    `).bind(targetUserId).first();
    if (!current || current.bonus_hatches <= 0) {
      return error(c, "NO_BONUS", "\uD68C\uC218\uD560 \uBCF4\uB108\uC2A4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.", 400);
    }
    const revokedAmount = current.bonus_hatches;
    await c.env.DB.prepare(`
      UPDATE incubator_bonus SET bonus_hatches = 0, updated_at = datetime('now') WHERE user_id = ?
    `).bind(targetUserId).run();
    return success(c, {
      message: `${revokedAmount}\uD68C \uBCF4\uB108\uC2A4\uAC00 \uD68C\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`,
      revokedAmount
    });
  } catch (e) {
    console.error("Error revoking bonus:", e);
    return error(c, "SERVER_ERROR", "\uBCF4\uB108\uC2A4 \uD68C\uC218\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", 500);
  }
});
incubatorRoutes.delete("/admin/users/:userId/reset", authMiddleware, async (c) => {
  const user = c.get("user");
  const targetUserId = parseInt(c.req.param("userId"));
  if (user.role !== "master") {
    return error(c, "FORBIDDEN", "\uAE38\uB4DC \uB9C8\uC2A4\uD130\uB9CC \uCD08\uAE30\uD654\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.", 403);
  }
  try {
    const targetUser = await c.env.DB.prepare(`
      SELECT id, character_name FROM users WHERE id = ?
    `).bind(targetUserId).first();
    if (!targetUser) {
      return error(c, "NOT_FOUND", "\uC720\uC800\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", 404);
    }
    const statements = [
      // 인벤토리 삭제
      c.env.DB.prepare(`DELETE FROM incubator_inventory WHERE user_id = ?`).bind(targetUserId),
      // 히스토리 삭제
      c.env.DB.prepare(`DELETE FROM incubator_history WHERE user_id = ?`).bind(targetUserId),
      // 일일 통계 삭제
      c.env.DB.prepare(`DELETE FROM incubator_daily_stats WHERE user_id = ?`).bind(targetUserId),
      // 보너스도 초기화
      c.env.DB.prepare(`DELETE FROM incubator_bonus WHERE user_id = ?`).bind(targetUserId)
    ];
    await c.env.DB.batch(statements);
    return success(c, {
      message: `${targetUser.character_name}\uB2D8\uC758 \uBD80\uD654\uAE30 \uB370\uC774\uD130\uAC00 \uCD08\uAE30\uD654\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`
    });
  } catch (e) {
    console.error("Error resetting user incubator:", e);
    return error(c, "SERVER_ERROR", "\uB370\uC774\uD130 \uCD08\uAE30\uD654\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", 500);
  }
});

// src/index.ts
var app = new Hono2();
app.use("*", cors({
  origin: ["https://maplestar.app", "https://www.maplestar.app", "http://localhost:5173"],
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  exposeHeaders: ["Content-Length"],
  maxAge: 86400
}));
app.route("/api/auth", authRoutes);
app.route("/api/posts", postRoutes);
app.route("/api/gallery", galleryRoutes);
app.route("/api/attendance", attendanceRoutes);
app.route("/api/members", memberRoutes);
app.route("/api/alliances", allianceRoutes);
app.route("/api/events", eventRoutes);
app.route("/api/notices", noticeRoutes);
app.route("/api/games", gameRoutes);
app.route("/api/scrolls", scrollRoutes);
app.route("/api/chaos", chaosRoutes);
app.route("/api/incubator", incubatorRoutes);
app.get("/api/images/*", async (c) => {
  try {
    if (!c.env.BUCKET) {
      return c.json({ success: false, error: { code: "NOT_CONFIGURED", message: "Image storage not configured" } }, 503);
    }
    const key = c.req.path.replace("/api/images/", "");
    const object = await c.env.BUCKET.get(key);
    if (!object) {
      return c.json({ success: false, error: { code: "NOT_FOUND", message: "Image not found" } }, 404);
    }
    const origin = c.req.header("Origin") || "";
    const allowedOrigins = ["https://maplestar.app", "https://www.maplestar.app", "http://localhost:5173"];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    const headers = new Headers();
    headers.set("Content-Type", object.httpMetadata?.contentType || "image/png");
    headers.set("Cache-Control", "public, max-age=31536000");
    headers.set("Access-Control-Allow-Origin", corsOrigin);
    headers.set("Access-Control-Allow-Credentials", "true");
    return new Response(object.body, { headers });
  } catch (e) {
    return c.json({ success: false, error: { code: "SERVER_ERROR", message: e.message } }, 500);
  }
});
app.get("/api/health", (c) => c.json({ success: true, data: { status: "ok" } }));
app.notFound((c) => c.json({ success: false, error: { code: "NOT_FOUND", message: "Not Found" } }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } }, 500);
});
var src_default = app;

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error2 = reduceError(e);
    return Response.json(error2, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-cMuQWr/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-cMuQWr/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
