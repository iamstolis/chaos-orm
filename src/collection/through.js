import {extend, merge} from 'extend-merge';
import Collection from "./collection";

/**
 * `Through` provide context-specific features for working with sets of data persisted by a backend data store.
 */
class Through {
  /**
   * Creates an alias on an other collection.
   *
   * @param Object config Possible options are:
   *                      - `'parent'`    _object_ : The parent instance.
   *                      - `'model'`     _string_ : The attached model class name.
   *                      - `'through'`   _string_ : The pivot relation name.
   *                      - `'using'`     _string_ : The target relation from pivot.
   *                      - `'data'`      _array_  : Some data to set on the collection.
   */
  constructor(config) {
    var defaults = {
      parent: undefined,
      model: undefined,
      through: undefined,
      using: undefined,
      data: []
    };

    config = extend({}, defaults, config);

    /**
     * A reference to this object's parent `Document` object.
     *
     * @var Object
     */
    this._parent = config.parent;

    /**
     * The fully-namespaced class name of the model object to which this entity set is bound. This
     * is usually the model that executed the query which created this object.
     *
     * @var Function
     */
    this._model = config.model;

    /**
     * A the pivot relation name.
     *
     * @var String
     */
    this._through = config.through;

    /**
     * A the target relation name in the pivot model.
     *
     * @var String
     */
    this._using = config.using;

    for (var name of ['parent', 'model', 'through', 'using']) {
      if (!config[name]) {
        throw new Error("Invalid through collection, `'" + name + "'` is empty.");
      }
      this['_' + name] = config[name];
    }

    for (var entity of config.data) {
      this.push(entity);
    }
  }

  /**
   * Gets/sets the parent instance.
   *
   * @param  Object parent The parent instance to set or nothing to get the current one.
   * @return Object
   */
  parent(parent) {
    if (!arguments.length) {
      return this._parent.get(this._through).parent();
    }
    this._parent.get(this._through).parent(parent);
    return this;
  }

  /**
   * Gets the base rootPath.
   *
   * @return String
   */
  rootPath() {
    return '';
  }

  /**
   * Returns the model on which this particular collection is based.
   *
   * @return Function The model.
   */
  model() {
    return this._model;
  }

  /**
   * Gets the meta data.
   *
   * @return Object
   */
  meta() {
    return this._parent.get(this._through).meta();
  }

  /**
   * Iterates over the collection.
   *
   * @param Function closure The closure to execute.
   */
  forEach(closure, thisArg) {
    var next = this[Symbol.iterator]().next;
    var current = next();

    if (thisArg) {
      closure = closure.bind(this);
    }

    while (!current.done) {
      closure(current.value[1], current.value[0], this);
      current = next();
    }
  }

  /**
   * Handles dispatching of methods against all items in the collection.
   *
   * @param  String method The name of the method to call on each instance in the collection.
   * @param  mixed  params The parameters to pass on each method call.
   *
   * @return mixed         Returns either an array of the return values of the methods, or the
   *                       return values wrapped in a `Collection` instance.
   */
  invoke(method, params) {
    var data = [];
    var callParams;
    var isCallable = params instanceof Function;

    params = params || [];

    this.forEach(function(value, key) {
      callParams = isCallable ? params(value, key, this) : params;
      data.push(value[method].apply(value, callParams));
    });

    return data;
  }

  /**
   * Returns a boolean indicating whether an offset exists for the
   * current `Collection`.
   *
   * @param  integer offset Integer indicating the offset or index of an entity in the set.
   * @return Boolean        Result.
   */
  isset(offset) {
    return this._parent.get(this._through).isset(offset);
  }

  /**
   * Gets an `Entity` object.
   *
   * @param  integer offset The offset.
   * @return mixed          Returns an `Entity` object if exists otherwise returns `undefined`.
   */
  get(offset) {
    var entity = this._parent.get(this._through).get(offset)
    if (entity) {
      return entity.get(this._using);
    }
  }

  /**
   * Adds the specified object to the `Collection` instance, and assigns associated metadata to
   * the added object.
   *
   * @param  integer offset The offset to assign the value to.
   * @param  mixed   data   The entity object to add.
   * @return mixed          Returns the set `Entity` object.
   */
  set(offset, data) {
    var name = this._through;
    return this._parent.get(name).set(offset, this._item(data));
  }

  /**
   * Adds data into the `Collection` instance.
   *
   * @param  mixed data The entity object to add.
   * @return mixed      Returns the set `Entity` object.
   */
  push(data) {
    var name = this._through;
    return this._parent.get(name).push(this._item(data));
  }

  /**
   * Creates a pivot instance.
   *
   * @param  mixed data The data.
   * @return mixed      The pivot instance.
   */
  _item(data) {
    var name = this._through;
    var parent = this.parent();
    var relThrough = this._parent.model().relation(name);
    var through = relThrough.to();
    var item = through.create(this._parent.exists() ? relThrough.match(this._parent) : {});
    item.set(this._using, data);
    return item;
  }

  /**
   * Unsets an offset.
   *
   * @param integer offset The offset to unset.
   */
  unset(offset) {
    this._parent.get(this._through).unset(offset);
  }

  /**
   * Merges another collection to this collection.
   *
   * @param  mixed   collection   A collection.
   *
   * @return Object               Return the merged collection.
   */
  merge(collection) {

    collection.forEach(function(value) {
      this.push(value);
    }.bind(this));

    return this;
  }

  /**
   * Returns the item keys.
   *
   * @return Array The keys of the items.
   */
  keys() {
    return this._parent.get(this._through).keys();
  }

  /**
   * Counts the items of the object.
   *
   * @return integer Returns the number of items in the collection.
   */
  count() {
    return this._parent.get(this._through).count();
  }

  /**
   * Delegates `.length` property to `.count()`.
   */
  get length() { return this.count(); }

  /**
   * Ignores `.length` updates.
   */
  set length(value) {}


  /**
   * Filters a copy of the items in the collection.
   *
   * @param  Closure $closure The closure to use for filtering, or an array of key/value pairs to match.
   * @return object           Returns a collection of the filtered items.
   */
  find(closure) {
    var data = [];

    this.forEach(function(value) {
      if (closure(value)) {
        data.push(value);
      }
    });
    return new Collection({ data: data });
  }

  /**
   * Applies a closure to all items in the collection.
   *
   * @param  Closure $closure The closure to apply.
   * @return object           This collection instance.
   */
  apply(closure) {
    this.forEach(function(value, key) {
      this.set(key, closure(value, key, this));
    }.bind(this));
    return this;
  }

  /**
   * Applies a closure to a copy of all data in the collection
   * and returns the result.
   *
   * @param  Closure closure The closure to apply.
   * @return mixed           Returns the set of filtered values inside a `Collection`.
   */
  map(closure) {
    var data = [];
    this.forEach(function(value, key) {
      data.push(closure(value));
    });
    return new Collection({ data: data });
  }

  /**
   * Reduces, or folds, a collection down to a single value
   *
   * @param  Closure closure The filter to apply.
   * @param  mixed   initial Initial value.
   * @return mixed           The reduced value.
   */
  reduce(closure, initial) {
    var result = initial !== undefined ? initial : 0;
    this.forEach(function(value, key) {
      result = closure(result, value);
    });
    return result;
  }

  /**
   * Extracts a slice of length items starting at position offset from the Collection.
   *
   * @param  integer offset The offset value.
   * @param  integer length The number of element to extract.
   * @return Object         Returns a collection instance.
   */
  slice(offset, length) {
    var result = this._parent.get(this._through).slice(offset, length);
    var data = [];
    result.forEach(function(value, key) {
      data.push(value.get(this._using));
    }.bind(this));
    return new Collection({ data: data });
  }

  /**
   * Eager loads relations.
   *
   * @param Array relations The relations to eager load.
   */
  embed(relations) {
    this._model.schema().embed(this, relations);
  }

  /**
   * Converts the current state of the data structure to an array.
   *
   * @param  Array options The options array.
   * @return array         Returns the array value of the data in this `Collection`.
   */
  data(options){
    return Collection.toArray(this, options);
  }

  /**
   * Iterator
   */
  [Symbol.iterator]() {
    var index = 0;
    return {
      next: function() {
        var collection = this._parent.get(this._through);
        if (index >= collection.length) {
          return { done: true };
        } else {
          return { value: [index, collection.get(index++).get(this._using)], done: false };
        }
      }.bind(this)
    };
  }
}

export default Through;
