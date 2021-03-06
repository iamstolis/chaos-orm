var Conventions = require('../../../src/conventions');
var Relationship = require('../../../src/relationship');
var Model = require('../../../src/').Model;
var HasMany = require('../../../src/relationship/has-many');

var Gallery = require('../../fixture/model/gallery');
var Image = require('../../fixture/model/image');
var ImageTag = require('../../fixture/model/image-tag');

describe("HasMany", function() {

  beforeEach(function() {
    this.conventions = new Conventions();
    this.key = this.conventions.apply('key');
  });

  afterEach(function() {
    Image.reset();
    ImageTag.reset();
    Gallery.reset();
  });

  describe(".constructor()", function() {

    it("creates a hasMany relationship", function() {

      var relation = new HasMany({
        from: Gallery,
        to: Image
      });

      expect(relation.name()).toBe(this.conventions.apply('field', 'Image'));

      var foreignKey = this.conventions.apply('reference', 'Gallery');

      var expected = {};
      expected[this.key] = foreignKey;
      expect(relation.keys()).toEqual(expected);

      expect(relation.from()).toBe(Gallery);
      expect(relation.to()).toBe(Image);
      expect(relation.link()).toBe(Relationship.LINK_KEY);
      expect(relation.fields()).toBe(true);
      expect(relation.conventions() instanceof Conventions).toBe(true);

    });

    it("throws an exception if `'from'` is missing", function() {

      var closure = function() {
        new HasMany({
          to: Image
        });
      };
      expect(closure).toThrow(new Error("The relationship `'from'` option can't be empty."));

    });

    it("throws an exception if `'to'` is missing", function() {

      var closure = function() {
        new HasMany({
          from: Gallery
        });
      };
      expect(closure).toThrow(new Error("The relationship `'to'` option can't be empty."));

    });

  });

  describe(".embed()", function() {

    beforeEach(function() {

      spyOn(Image, 'all').and.callFake(function(options, fetchOptions) {
        fetchOptions = fetchOptions || {};
        var images =  Image.create([
          { id: 1, gallery_id: 1, title: 'Amiga 1200' },
          { id: 2, gallery_id: 1, title: 'Srinivasa Ramanujan' },
          { id: 3, gallery_id: 1, title: 'Las Vegas' },
          { id: 4, gallery_id: 2, title: 'Silicon Valley' },
          { id: 5, gallery_id: 2, title: 'Unknown' }
        ], {
          type: 'set', exists: true, collector: fetchOptions.collector
        });
        if (fetchOptions['return'] && fetchOptions['return'] === 'object') {
          return Promise.resolve(images.data());
        }
        return Promise.resolve(images);
      });

    });

    it("embeds a hasMany relationship", function(done) {

      var hasMany = Gallery.definition().relation('images');

      var galleries = Gallery.create([
        { id: 1, name: 'Foo Gallery' },
        { id: 2, name: 'Bar Gallery' }
      ], { type: 'set', exists: true });

      galleries.embed(['images']).then(function() {
        expect(Image.all).toHaveBeenCalledWith({
          conditions: { gallery_id: [1, 2] }
        }, {
          collector: galleries.collector()
        });

        galleries.forEach(function(gallery) {
          gallery.get('images').forEach(function(image) {
            expect(image.get('gallery_id')).toBe(gallery.get('id'));
            expect(gallery.collector()).toBe(galleries.collector());
            expect(image.collector()).toBe(galleries.collector());
          });
        });
        done();
      });

    });

    it("embeds a hasMany relationship using object hydration", function(done) {

      var hasMany = Gallery.definition().relation('images');

      var galleries = Gallery.create([
        { id: 1, name: 'Foo Gallery' },
        { id: 2, name: 'Bar Gallery' }
      ], { type: 'set', exists: true });

      galleries = galleries.data();

      hasMany.embed(galleries, { fetchOptions: { 'return': 'object' } }).then(function() {
        expect(Image.all).toHaveBeenCalledWith({
          conditions: { gallery_id: [1, 2] }
        }, {
          'collector': undefined,
          'return': 'object'
        });

        galleries.forEach(function(gallery) {
          gallery.images.forEach(function(image) {
            expect(gallery.id).toBe(image.gallery_id);
            expect(image instanceof Model).toBe(false);
          });
        });
        done();
      });

    });

  });

  describe(".broadcast()", function() {

    it("bails out if no relation data hasn't been setted", function(done) {

      var hasMany = Gallery.definition().relation('images');
      var gallery = Gallery.create({ id: 1, name: 'Foo Gallery' },  { exists: true });
      hasMany.broadcast(gallery).then(function() {
        expect(gallery.has('images')).toBe(false);
        done();
      });

    });

    it("saves a hasMany relationship", function(done) {

      spyOn(Image, 'all').and.callFake(function() {
        return Promise.resolve(Image.create([], { type: 'set' }));
      });

      var hasMany = Gallery.definition().relation('images');

      var gallery = Gallery.create({ id: 1, name: 'Foo Gallery' }, { exists: true });
      gallery.set('images', [{ name: 'Foo Image' }]);

      spyOn(gallery.get('images').get(0), 'broadcast').and.callFake(function() {
        gallery.get('images').get(0).set('id', 1);
        return Promise.resolve(gallery);
      });

      hasMany.broadcast(gallery).then(function() {
        expect(gallery.get('images').get(0).broadcast).toHaveBeenCalled();
        expect(gallery.get('images').get(0).get('gallery_id')).toBe(gallery.get('id'));
        done();
      });

    });

    it("assures removed association to be unsetted", function(done) {

      var toUnset = Image.create({ id: 2, gallery_id: 1, title: 'Srinivasa Ramanujan' }, { exists: true });
      var toKeep = Image.create({ id: 3, gallery_id: 1, title: 'Las Vegas' }, { exists: true });

      spyOn(Image, 'all').and.callFake(function(options, fetchOptions) {
        return Promise.resolve(Image.create([toUnset, toKeep], { type: 'set' }));
      });

      var hasMany = Gallery.definition().relation('images');

      var gallery = Gallery.create({ id: 1, name: 'Foo Gallery' }, { exists: true });
      gallery.set('images', [{ title: 'Amiga 1200' }, toKeep]);

      spyOn(gallery.get('images').get(0), 'broadcast').and.callFake(function() {
        gallery.get('images').get(0).set('id', 1);
        return Promise.resolve(gallery);
      });

      spyOn(toKeep, 'broadcast').and.returnValue(Promise.resolve(toKeep));
      spyOn(toUnset, 'broadcast').and.returnValue(Promise.resolve(toUnset));

      hasMany.broadcast(gallery).then(function() {
        expect(toUnset.exists()).toBe(true);
        expect(toUnset.get('gallery_id')).toBe(undefined);
        expect(gallery.get('images').get(0).get('gallery_id')).toBe(gallery.get('id'));

        expect(gallery.get('images').get(0).broadcast).toHaveBeenCalled();
        expect(toKeep.broadcast).toHaveBeenCalled();
        expect(toUnset.broadcast).toHaveBeenCalled();
        done();
      });

    });

    it("assures removed associative entity to be deleted", function(done) {

      var toDelete = ImageTag.create({ id: 5, image_id: 4, tag_id: 6 }, { exists: true });
      var toKeep = ImageTag.create({ id: 6, image_id: 4, tag_id: 3 }, { exists: true });

      spyOn(ImageTag, 'all').and.callFake(function(options, fetchOptions) {
        return Promise.resolve(ImageTag.create([toDelete, toKeep], { type: 'set' }));
      });

      var hasMany = Image.definition().relation('images_tags');

      var image = Image.create({ id: 4, gallery_id: 2, title: 'Silicon Valley' }, { exists: true });
      image.set('images_tags', [{ tag_id: 1 }, toKeep]);

      spyOn(image.get('images_tags').get(0), 'broadcast').and.callFake(function() {
        image.get('images_tags').get(0).set('id', 7);
        return Promise.resolve(image);
      });

      var schema = ImageTag.definition();
      spyOn(toKeep, 'broadcast').and.returnValue(Promise.resolve(toKeep));
      spyOn(schema, 'truncate').and.returnValue(Promise.resolve(true));

      hasMany.broadcast(image).then(function() {
        expect(toDelete.exists()).toBe(false);
        expect(image.get('images_tags').get(0).get('image_id')).toBe(image.get('id'));

        expect(image.get('images_tags').get(0).broadcast).toHaveBeenCalled();
        expect(toKeep.broadcast).toHaveBeenCalled();
        expect(schema.truncate).toHaveBeenCalledWith({ id: 5 });
        done();
      });

    });

  });

});