/*
 * Is property defined?
 */
function isDefined(property) {
  // workaround https://github.com/douglascrockford/JSLint/commit/24f63ada2f9d7ad65afc90e6d949f631935c2480
  var propertyType = typeof property;

  return propertyType !== 'undefined';
}

/*
 * Is property a function?
 */
function isFunction(property) {
  return typeof property === 'function';
}

/*
 * Is property an object?
 *
 * @return bool Returns true if property is null, an Object, or subclass of Object (i.e., an instanceof String, Date, etc.)
 */
function isObject(property) {
  return typeof property === 'object';
}

/*
 * Is property a string?
 */
function isString(property) {
  return typeof property === 'string' || property instanceof String;
}

module.exports = {
  isDefined: isDefined,
  isFunction: isFunction,
  isObject: isObject,
  isString: isString
};