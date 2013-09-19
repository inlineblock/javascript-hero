var Game = Backbone.View.extend({
  className: 'goals-timeline',

  template: 
    '<div class="scene">' +
      '<div class="horizon"></div>' +
      '<div class="ground">' +
        '<svg width="0" height="0">' +
          '<defs>' +
            '<linearGradient id="goal-timeline-grad" x1="0" y1="0" x2="0" y2="100%">' +
              '<stop offset="0%" stop-color="#4d4f53" />' +
              '<stop offset="20%" stop-color="#666" />' +
              '<stop offset="100%" stop-color="#666" />' +
            '</linearGradient>' +
          '</defs>' +
          '<path class="grass" d="M 0,0 L 0,0 L 0,0, L 0,0 z" fill="url(#goal-timeline-grad)"/>' +
          '<path class="verticals" />' +
        '</svg>' +
      '</div>' +
    '</div>' +
    '<div class="paused-text-container"><div class="paused-text">~ PAUSED ~</div></div>',

  options: {
    numMarkers: 12,
    maxBubbleSize: 100,
    timeToShow: 6000, // 12 seconds
    interval: 1000/30,
    minTimeBetween: 750,
    maxTimeBetween: 1250,
    accuracy: 250,
    accuracyOffset: 100,
    score: 2500,
    keys: [
      'A',
      'S',
      'D',
      'F'
    ]
  },

  events: {
  },

  initialize: function () {
    this.data = [];
    this.$document = $(document);
    this.$window = $(window);
    this.$body = $('body');
    this.onInterval = this.onInterval.bind(this);
    this.$el.html(this.template);
    this.setup();
    this.build();
    this.attach();
    this.render();
  },

  setup: function () {
    this.timeScale = d3.time.scale().range([0, 1]);

    this.scoreScale = d3.scale.sqrt()
      .domain([this.options.accuracy, 0])
      .rangeRound([0, this.options.score]);

    this.zIndexScale = d3.scale.linear()
      .domain([0, 1])
      .rangeRound([100, 10]);

    this.opacityScale = d3.scale.linear()
      .domain([-0.02, 0.00, 0.3, 1])
      .range([0.0, 1, 1, 0.1]);

    this.markerOpacityScale = d3.scale.linear()
      .domain([-0.02, 0.02, 0.3, 1])
      .range([0.0, 1, 0.1, 0]);

    this.xScale = d3.scale.linear()
      .domain([-0.9, 0.9]);

    this.yScale = d3.scale.linear()
      .domain([0, 1]);

    this.projectionScale = d3.scale.linear()
      .domain([-0.01, 1.0])
      .range([1.00, 25]);

    this.colorScale = d3.scale.category10().domain([0, this.options.keys.length-1]);
  },

  start: function () {
    if (!this.started) {
      this.started = true;
      this.layout();
      if (this.stoppedTime && this.data.length) {
        this.adjustDataForStoppedTime();
      }
      this.setDate();
      this.interval = window.setInterval(this.onInterval, this.options.interval);
      this.$el.removeClass('paused');
    }
  },

  adjustDataForStoppedTime: function () {
    var diff = new Date().getTime() - this.stoppedTime.getTime();
    _.each(this.data, function (o) {
      o.date = new Date(o.date.getTime() + diff);
    });
  },

  stop: function () {
    if (this.started) {
      window.clearInterval(this.interval);
      this.$el.addClass('paused');
      this.started = false;
      this.stoppedTime = new Date();
    }
  },

  onInterval: function () {
    this.setDate();
    this.addMoreBubbles();
  },

  attach: function () {
    this.$document.on('keydown', this.onKeydown.bind(this));
    this.$window.on('resize', this.onWindowResize.bind(this));

    this.$window.on('scroll touchmove', function (evt) { evt.preventDefault(); });
    this.$body.on('scroll touchmove', function (evt) { evt.preventDefault(); });
  },

  onWindowResize: function () {
    this.layout();
    this.renderGround();
  },

  onKeydown: function (evt) {
    if (evt.altKey || evt.ctrlKey || evt.metaKey) {
      return;
    }
    if (evt.which === 27) {
      evt.preventDefault();
      if (this.started) {
        return this.stop();
      } else {
        return this.start();
      }
    }
    if (!this.started) {
      return;
    }
    evt.preventDefault();
    this.processKeyHit(String.fromCharCode(evt.keyCode));
  },

  processKeyHit: function (key) {
    var current = new Date().getTime() + this.options.accuracyOffset,
      high = current + this.options.accuracy,
      low = current - this.options.accuracy,
      bestBubble = false,
      highScore,
      score,
      diff,
      bubble;
    if (this.options.keys.indexOf(key) !== -1) {
      for (var i = 0; i < this.data.length; i++) {
        bubble = this.data[i];
        if (bubble.timeStamp > high) {
          break;
        }
        if (!bubble.beenHit && bubble.key === key && bubble.timeStamp >= low && bubble.timeStamp <= high) {
          diff = Math.abs(current - bubble.timeStamp);
          score = this.scoreScale(Math.abs(diff));
          if (!bestBubble || score > highScore) {
            highScore = score;
            bestBubble = bubble;
          }
        }
      }
    }
    if (bestBubble) {
      this.trigger('score', {score: highScore, bubble: bestBubble});
      bestBubble.beenHit = true;
    }
  },

  build: function () {
    var that = this;
    this.setDate(new Date());
    this.interpretData();
    this.layout();
  },

  layout: function () {
    var
      w = this.$el.width() || 848,
      h = this.$el.height() || 518,
      s = Math.min(w, h);

    this.xScale
      .range([0, w]);

    this.yScale
      .range([h*0.125, h]);

    d3.select(this.el).select('.ground').select('svg')
      .attr('width', w)
      .attr('height', h);
  },

  render: function () {
    this.renderGround();
    this.renderBubbles();
  },

  renderGround: function () {
    var
      that = this,
      opts = this.options,
      ticks = this.timeScale.ticks(d3.time.seconds, 1),
      format = this.timeScale.tickFormat(d3.time.seconds, 1),
      markers;

    d3.select(this.el).select('.horizon')
      .style('top', function () {
        var
          z = that.timeScale(new Date(that.date.getTime() + (that.options.accuracyOffset/2))),
          p = 1 / that.projectionScale(z);
        return Math.ceil(that.yScale(p)) + 'px';
      });

    d3.select(this.el).select('.grass')
      .attr('d', function () {
        var
          near = 1/that.projectionScale.range()[0],
          far = 1/that.projectionScale.range()[1];

        return (
          'M ' + that.xScale(0) + ',' + that.yScale(0) + ' ' +
          'L ' + that.xScale( 1*near) + ',' + that.yScale(near) + ' ' +
          'L ' + that.xScale(-1*near) + ',' + that.yScale(near) + ' ' +
          'z'
        );
      });

    d3.select(this.el).select('.verticals')
      .attr('d', function () {
        var
          near = 1/that.projectionScale.range()[0],
          far = 1/that.projectionScale.range()[1],
          i = -1,
          delta = 2/(that.options.keys.length + 1)
          segs = [];

        while (1 > (i+=delta)) {
          segs.push(
            'M ' + that.xScale(0) + ',' + that.yScale(0) + ' ' +
            'L ' + that.xScale( 1*near * i) + ',' + that.yScale(near)
          );
        }

        return segs.join(' ');
      });

    markers = d3.select(this.el).select('.ground').selectAll('.marker')
      .data(ticks, function (d) {
        return d.getTime();
      })

    markers.enter()
      .insert('div', ':first-child')
        .attr('class', 'marker')
        .style('opacity', 0);

    markers
      .style('opacity', function (d) {
        var
          z = that.timeScale(d),
          p = 1 / that.projectionScale(z);
        return that.markerOpacityScale(z);
      })
      .style('z-index', function (date, i, a) {
        return that.zIndexScale(that.timeScale(date)) - 2;
      })
      .style('top', function (d) {
        var
          z = that.timeScale(d),
          p = 1 / that.projectionScale(z);
        return that.yScale(p) + 'px';
      })
      .style('left', function (d) {
        var
          z = that.timeScale(d),
          p = 1 / that.projectionScale(z);
        return that.xScale(-1*p) + 'px';
      })
      .style('right', function (d) {
        var
          z = that.timeScale(d),
          p = 1 / that.projectionScale(z);
        return that.xScale(-1*p) + 'px';
      })
      .style('font-size', function (d) {
        var
          z = that.timeScale(d),
          p = 1 / that.projectionScale(z);
        return (p*35) + 'px';
      });

    markers.exit()
      .remove();
  },

  renderBubbles: function () {
    var
      that = this,
      opts = this.options,
      bubbles;

    // Data
    bubbles = d3.select(this.el).selectAll('.bubble')
      .data(this.data, function (d) {
        return d.id;
      });

    // Enter
    bubbles.enter()
      .append('div')
        .attr('class', 'bubble')
        .attr('data-r', function (d) {
          var
            z = that.timeScale(d.date),
            p = 1 / that.projectionScale(z),
            r = that.options.maxBubbleSize * p,
            $this = $(this);
          this.$this = $this;
          $this.css({
            fontSize: r,
            width: r*2,
            height: r*2,
            backgroundColor: d.color
          });

          this.innerText = d.key;
          return r;
        })
        .style('opacity', 1e-3);

    // Update
    bubbles
      .attr('data-r', function (d, i) {
        var
          z = that.timeScale(d.date),
          p = 1 / that.projectionScale(z),
          r = Math.max(~~(that.options.maxBubbleSize * p), 0.01);

          this.$this.css({
            fontSize: r,
            width: r*2,
            height: r*2,
          });
          if (d.beenHit && !d.classAdded) {
            d.classAdded = true;
            this.$this.addClass('has-been-hit');
          }
          return r;
      })
      .style('opacity', function (d) {
        var
          z = that.timeScale(d.date),
          p = 1 / that.projectionScale(z);
        return that.opacityScale(z);
      })
      .style('z-index', function (d, i, a) {
        return that.zIndexScale(that.timeScale(d.date));
      })
      .style('top', function (d) {
        var
          z = that.timeScale(d.date),
          p = 1 / that.projectionScale(z),
          r = that.options.maxBubbleSize * p;
        return that.yScale(p) + 'px';
      })
      .style('left', function (d, i) {
        var
          division = 2 / (that.options.keys.length + 1),
          z = that.timeScale(d.date),
          p = 1 / that.projectionScale(z),
          r = that.options.maxBubbleSize * p,
          c = -1 + ((d.i%that.options.keys.length) + 1) * division;
        return that.xScale(c*p) + 'px';
      })
      .style('margin-top', function (d) {
        var
          z = that.timeScale(d.date),
          p = 1 / that.projectionScale(z),
          r = that.options.maxBubbleSize * p;
        return -r*2 + 'px';
      })
      .style('margin-left', function (d) {
        var
          z = that.timeScale(d.date),
          p = 1 / that.projectionScale(z),
          r = that.options.maxBubbleSize * p;
        return -r + 'px';
      });


    // Exit
    bubbles
      .exit()
      .remove();
  },

  interpretData: function () {
    this.timeScale
      .domain([this.date, new Date(this.date.getTime() + this.options.timeToShow)]);
  },

  addMoreBubbles: function () {
    var last = _.last(this.data),
      random = Math.random(),
      difference = this.options.maxTimeBetween - this.options.minTimeBetween,
      date = new Date(new Date().getTime() + this.options.timeToShow + Math.floor(Math.random() * this.options.interval)),
      bubbleDifference,
      bubble;
    if (!last) {
      bubble = this.createBubble(date);
    } else {
      bubbleDifference = date.getTime() - last.date.getTime();
      if (bubbleDifference > this.options.maxTimeBetween || (bubbleDifference > (difference * random)) && bubbleDifference > this.options.minTimeBetween) {
        bubble = this.createBubble(date);
      }
    }
    if (bubble) {
      this.data.push(bubble);
    }
  },

  createBubble: function (date) {
    var i = Math.floor(Math.random() * this.options.keys.length);
    return {
      date: date,
      timeStamp: date.getTime(),
      i: i,
      key: this.options.keys[i],
      color: this.colorScale(i),
      id: _.uniqueId('bubble')
    }
  },

  cleanData: function () {
    this.data = _.filter(this.data, function (o) {
      return (o.date.getTime() + 1000) > this.date.getTime();
    }, this);
  },

  setDate: function (d) {
    this.date = new Date();
    this.cleanData();
    this.interpretData();
    this.render();
  }

});
