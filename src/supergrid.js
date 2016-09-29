(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(['jquery', 'lodash'], factory);
    } else if (typeof exports !== 'undefined') {
        try {jQuery = require('jquery');} catch (e) {}
        try {_ = require('lodash');} catch (e) {}
        factory(jQuery, _);
    } else {
        factory(jQuery, _);
    }
})(function ($, _) {
    var scope = window;

    var Node = function (element) {
        this.element = element;
        this.id = -1;
        this.x = element.data('grid-x');
        this.y = element.data('grid-y');
        this.width = element.data('grid-width');
        this.pixelY = 0;
        this.pixelHeight = 0;
        this.jsonId = -1;
    };

    Node.prototype.setId = function (id) {
        this.id = id;
        this.element.data('grid-id', id);
    };

    var SuperGrid = function (selector, options) {
        var self = this;

        this.options = _.defaults(options || {}, {
            static: true,
            resizableX: false,
            resizableY: false,
            dragZIndex: 100,
            minItemWidth: 1
        });

        this.state = {};
        this.state.dragEnabled = false;

        this.element = $(selector);
        this.nodes = [];
        this.draggingNodeId = -1;

        this.placeholderElement = $('<div class="grid-placeholder" />').hide();
        this.element.append(this.placeholderElement);

        this.itemElements = $('.grid-item', this.element);
        this.itemElements.each(function (index, item) {
            var $item = $(item);

            var node = new Node($item);
            node.setId(self.nodes.push(node) - 1);
            node.jsonId = $item.data('id');
        });

        this.layout();
        this.setStatic(this.options.static);

        $(window).on('resize', function () {self.onWindowResize();});
    };

    SuperGrid.prototype.setStatic = function (staticState) {
        this.options.static = staticState;

        if (staticState) {
            if (this.state.dragEnabled) {
                if (this.options.resizableX || this.options.resizableY) {
                    this.itemElements.resizable("destroy");
                }

                this.itemElements.draggable("destroy");
            }
        }
        else {
            if (!this.state.dragEnabled) {
                this.state.dragEnabled = true;

                this.itemElements.draggable({
                    containment: "parent",
                    zIndex: this.options.dragZIndex,
                    drag: this.onDrag.bind(this),
                    start: this.onDragStart.bind(this),
                    stop: this.onDragStop.bind(this)
                });

                if (this.options.resizableX || this.options.resizableY) {
                    var handles = (this.options.resizableX ? ['e', 'w'] : []).concat((this.options.resizableY ? ['s'] : [])).join(',');
                    this.itemElements.resizable({
                        autoHide: true,
                        containment: "parent",
                        handles: handles,
                        resize: this.onResize.bind(this),
                        start: this.onDragStart.bind(this),
                        stop: this.onDragStop.bind(this)
                    });
                }
            }
        }
    }

    SuperGrid.prototype.destroy = function () {
        $(window).off('resize', this.onWindowResize.bind(this));

        this.setStatic(true);

        _.forEach(this.nodes, function (node) {
            node.element.data('grid-id', null);
            node.element.removeClass('grid-placed');
        });
    };

    SuperGrid.prototype.layout = function () {
        var self = this;

        var lastY = [];
        var lastPixelY = [];
        var containerHeight = 0;
        for (var i = 0; i < 6; i++) {
            lastY[i] = 0;
            lastPixelY[i] = 0;
        }

        var sortedNodes = _.sortBy(this.nodes, function (n) {
            return n.y + ((n.id == self.draggingNodeId) ? 0.0 : 0.5) + (n.x / (6.0 * 2));
        });

        _.forEach(sortedNodes, function (node) {
            var startX = node.x;
            var endX = node.x + node.width;
            var x;

            // Find starting pixel Y
            node.y = 0;
            node.pixelY = 0;
            for (x = startX; x < endX; x++) {
                if (lastY[x] > node.y) node.y = lastY[x];
                if (lastPixelY[x] > node.pixelY) node.pixelY = lastPixelY[x];
            }

            // Get own pixel height
            node.pixelHeight = node.element.outerHeight(true);

            // Record last Y coordinates in relevant columns
            for (x = startX; x < endX; x++) {
                lastY[x] = node.y + 1;
                lastPixelY[x] = node.pixelY + node.pixelHeight;
            }

            // Place item
            node.element.attr({'data-grid-x': node.x, 'data-grid-y': node.y});
            node.element.addClass('grid-placed');
            node.element.css({top: node.pixelY});

            // Expand container
            var endPixelY = node.pixelY + node.pixelHeight;
            if (containerHeight < endPixelY) containerHeight = endPixelY;
        });

        // Set container height
        this.element.css('height', containerHeight);
    };

    SuperGrid.prototype.onResize = function(event, ui) {
        var node = this.nodes[ui.helper.data('grid-id')];

        var containerWidth = this.element.innerWidth();
        node.x = Math.max(Math.min(Math.floor(ui.position.left * 6.0 / containerWidth + 0.01), 6), 0);
        node.width = Math.max(Math.min(Math.ceil(ui.size.width * 6.0 / containerWidth), 6), this.options.minItemWidth);

        this.placeholderElement.attr({'data-grid-x': node.x, 'data-grid-width': node.width});
        this.placeholderElement.css({top: node.pixelY, height: node.pixelHeight});

        this.layout();
    };

    SuperGrid.prototype.onDrag = function (event, ui) {
        var node = this.nodes[ui.helper.data('grid-id')];

        var containerWidth = this.element.innerWidth();
        node.x = Math.max(Math.min(Math.round(ui.position.left * 6.0 / containerWidth), 6), 0);

        node.y = 0;
        _.forEach(this.nodes, function (otherNode) {
            if (node.x + node.width > otherNode.x && node.x < otherNode.x + otherNode.width && ui.position.top > otherNode.pixelY) {
                if (node.y < otherNode.y + 1) {
                    node.y = otherNode.y + 1;
                }
            }
        });

        this.placeholderElement.attr({'data-grid-x': node.x, 'data-grid-width': node.width});
        this.placeholderElement.css({top: node.pixelY, height: node.pixelHeight});

        this.layout();
    };

    SuperGrid.prototype.onDragStart = function (event, ui) {
        var node = this.nodes[ui.helper.data('grid-id')];

        this.draggingNodeId = node.id;

        this.placeholderElement.attr({'data-grid-x': node.x, 'data-grid-width': node.width});
        this.placeholderElement.css({top: node.pixelY, height: node.pixelHeight});
        this.placeholderElement.show();
    };

    SuperGrid.prototype.onDragStop = function (event, ui) {
        var node = this.nodes[ui.helper.data('grid-id')];

        this.draggingNodeId = -1;

        this.placeholderElement.hide();

        node.element.attr({'data-grid-x': node.x, 'data-grid-width': node.width});
        node.element.css({top: node.pixelY, width: '', left: ''});
        if (!this.options.resizableY) node.element.css({height: ''});
    };

    SuperGrid.prototype.onWindowResize = function () {
        this.layout();
    };

    SuperGrid.prototype.toJson = function () {
        return _.map(this.nodes, function (node) {
            return {id: node.jsonId, x: node.x, y: node.y, width: node.width};
        });
    };

    return scope.SuperGrid = SuperGrid;
});