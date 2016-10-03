# SuperGrid

SuperGrid is a javascript grid library fo the browser that supports drag-and-drop and resizing. It uses a fixed 6-column
layout where blocks always fall to the top of the grid.

SuperGrid is inspired by gridstack.js and gridster.js.

## Layout

Each block has a x-position, a y-position and a width. The x-position and width is in columns. The y-position is unitless
and only the relative y-positions between blocks matter. If the y-position of a block is larger than another block's then
it will be placed below that block. If they are the same and they overlap on the x-axis then the block with the larger
x-position is placed below the other block. If they still tie then there order in the html is used to determine which is
placed below the other.

## Usage
`var superGrid = new SuperGrid(<selector>, <options>);`

### Browser support
 IE8-IE10 is supported for static grids only.

### Requirements

* lodash.js
* jQuery

**For dragging or resizing**

* jQuery UI

### Options

* *animated* (default: false)
  When set to true, blocks are animated when dragging or resizing.

* *collapseContainerWidth* (default: 700)
  When the container width falls below this width in pixels then the grid will collapse to a single column.

* *dragZIndex* (default: 100)
  The Z-index given to the item being dragged.
  
* *minItemWidth* (default: 1)
  The minimum amount of columns an item must span. Blocks can not be resized to be smaller than this.
  
* *resizableX* (default: false)
  When set to true and staticGrid is false, horizontal resizing is enabled. Item sizes snap to columns.
  
* *resizableY* (default: false)
  When set to true and staticGrid is false, vertical resizing is enabled, blocks can be resized to any height.

* *staticGrid* (default: true)
  When set to false, dragging and resizing is enabled (dependent on other options) but requires jQuery UI.

### CSS classes

* *grid*
  The container div must have the *grid* class
  
* *grid-item*
    For each block in the grid there must be a div with the *grid-item* class
  
    Attributes:
    
    * *data-id* (Optional)
      ID used when generating JSON.
    * *data-grid-x*
      X-position of block in columns.
    * *data-grid-width*
      Width of block in columns.
    * *data-grid-y*
      Y-position of block.
  
* *grid-item-content*
  Each *grid-item* must have a *grid-item-content* div directly inside it

### Methods

* *layout()*
    Used to force a relayout of the grid when, for example, the height of a block changes.
    
* *addItem(\<element\>)*
    Add a block that didn't exist when SuperGrid was initialized. The element must already
    be added to the container.
    
* *removeItem(\<element\>)*
    Remove a block from SuperGrid. The element must be manually removed from container.
    
* *toJson()*
    Generates JSON for the block positions in the following format:
    `[{id: <id>, x_pos: <x>, y_pos: <y>, width: <width>}, ...]`
    
* *destroy()*
    Removes all blocks from SuperGrid and removes all attached events.

### Example

```HTML
    <div id="grid-container" class="grid">
        <div class="grid-item" data-id="1" data-grid-x="0" data-grid-y="0" data-grid-width="3"
            <div class="grid-item-content">
                <h1>Heading 1</h1>
                <p>Text 1</p>
            </div>
        </div>
        <div class="grid-item" data-id="2" data-grid-x="1" data-grid-y="0" data-grid-width="3"
            <div class="grid-item-content">
                <h1>Heading 2</h1>
                <p>Text 2</p>
            </div>
        </div>
    </div>
    <script>
        new SuperGrid('#grid-container', {staticGrid: true});
    </script>
```