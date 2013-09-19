var ControllerBar = Backbone.View.extend({
  className: 'controller-bar',
  options: {
  },

  events: {
    'touchstart button' : 'onButtonTouch',
    'click button' : 'onButtonTouch'
  },
  
  buttonTemplate: _.template('<button data-key="<%= key %>"><%= key %></button>'),

  initialize: function () {
    this.build();
  },

  build: function () {
    var keys = _.clone(this.options.keys);
    var html = _.map(keys, function (k) {
      return this.buttonTemplate({
        key: k
      });
    }, this).join('');
    this.$el.html(html);
  },

  onButtonTouch: function (evt) {
    evt.preventDefault();
    this.trigger('press' , {key: $(evt.target).data('key')});
  }
});
