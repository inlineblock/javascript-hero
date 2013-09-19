var ScoreBar = Backbone.View.extend({

  template: 'JavaScript Hero<div class="score"></div><div class="hits"></div>',

  scoreTemplate: _.template('Score: <%= model.get("score") %>'),
  hitsTemplate: _.template('Hits: <%= model.get("hits") %>'),

  initialize: function () {
    this.build();
    this.attach();
    this.render();
  },
  
  build: function () {
    this.$el.html(this.template);
    this.$score = this.$('.score');
    this.$hits = this.$('.hits');
  },

  attach: function () {
    this.listenTo(this.model, 'change:score', this.onScoreChange);
  },

  onScoreChange: function () {
    this.render();
  },

  render: function () {
    this.$score.text(this.scoreTemplate({model: this.model}));
    this.$hits.text(this.hitsTemplate({model: this.model}));
  }
});
