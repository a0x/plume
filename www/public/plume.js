/**
 * In this file of code, the author did three things:
 *   1. init the editor
 *   2. init the doc typed rich-text using sharejs
 *   3. bound `cursor` onto the editor, and communicate with the doc:
 *     3.1 data sync
 *     3.2 cursor sync
 *
 * However, there is at least one thing to be done:
 *   * to deal with the lock in `doc`.
 *
 */


// `userId` is the key to different users.
var userId = 'id-' + Math.random(10) * 1000;
var editor = new Quill('#editor', {
    modules: {
        'toolbar'     : {container: '#toolbar'},
        'authorship'  : {authorId: userId, enabled: true, color:  'rgb(255, 0, 255)', button: $('#authors')[0]},
        'link-tooltip': true
    },
    theme  : 'snow'
});
console.log(editor);

// Init ShareJS
var socket = new BCSocket(null, {reconnect: true});
var sjs = new sharejs.Connection(socket);
// Register the ot-type as rich-text
sharejs.registerType(window.ottypes['rich-text']);

var doc = sjs.get('docs', 'hello2');

// Subscribe to changes
doc.subscribe();

// This will be called when we have a live copy of the server's data.
doc.whenReady(function () {

	console.log('doc ready, data: ', doc);

	// Create a rich-text doc
	if (!doc.type) {
		console.log('doc has not type - trying to create a rich-text doc');
        // This line of code does the thing that created a doc as rich-text, and set default as ''.
		doc.create('rich-text', '');
		console.log('created as ', doc);
	}

	//editor.modules.authorship.attachButton($('#authors'));
	var multiCursor = editor.addModule('multi-cursor', {
		timeout: 10000
	});

	// Update the doc with the recent changes
	editor.updateContents(doc.getSnapshot());

	// Cursor handling managed by Primus which is a socket wrapper

    // init Primus
	var primus = Primus.connect('', {});
    window.primus = primus;

    /* 1st event
     * TODO: what does 'open' mean?
     */
	primus.on('open', function open() {
		console.log('Connection is alive and kicking');
	});

    /* 2nd event: sync the cursors when data comes in. */
    // Consider `data` as users' input. And this event is the most
    // important one of all the events bound to `primus`
	primus.on('data', function message(data) {
		var cursor =  data.cursor;
		multiCursor.removeCursor(cursor.id);
		multiCursor.setCursor(cursor.id, cursor.start, cursor.name, cursor.colour);
		console.log('Received a new message from the server: ', data.cursor);
	});

    /* 3rd event: error alert. */
	primus.on('error', function error(err) {
		console.error('Something horrible has happened', err.stack);
	});

	//************ end ***************//

    /* 4th event: dealing with text selection. */
	editor.on('selection-change', function (range) {
		var c = hexToRgb($('#cursor-colour').val());
		var colour = 'rgb(' + c.r + ', ' + c.g + ', ' + c.b + ')';
		var cursor = {'start': range.start,
			'end': range.end,
			'colour': colour,
			'name': $('#name').val(),
			'id': userId
		};

		primus.write({'cursor': cursor});
	});

    /* 5th event: submit local text change as rich-text ot. */
	editor.on('text-change', function (delta, source) {
		console.log('text-change', delta, source);
		doc.submitOp(delta);
	});

    /* 6th event: update local content with rich-text ot from remote. */
	doc.on('op', function (op, localContext) {
		if (!localContext) {
			editor.updateContents(op.ops);
		}
	})
});

// This function is used to mark the multiple cursors.
function hexToRgb(hex) {
	var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result ? {
		r: parseInt(result[1], 16),
		g: parseInt(result[2], 16),
		b: parseInt(result[3], 16)
	} : null;
}


/**
 * Questions:
 * 0. What is 'multi-cursor' module?
 * 1. What is Primus?
 * 2. Why need multi-cursor?
 * 3. Did the author customize the Quill Editor?
 * 4. How does Simditor integrate Primus?
 * 5. How does Quill editor deal with ot formatted in rich-text?
 * 6. How should rich-text ot be applied?
 * 7. How does Simditor apply ot formatted in rich-text?
 * 8. What's the error/bug inside this project?
 * 9. Can the order of these 6 events changed?
 * 10. How does Quill editor `updateContents()`?
 */

/**
 * Sequences of apply rich-text ot:
 * After initializing the editor and the doc:
 * 1. track the cursor locally on each client
 * 2. submitOp() when text changed
 * 3. updateContents() when receive rich-text ops from remote
 *
 * Another work is to highlight text selection, and apply the
 * rich-text style remotely, this feature need to operation:
 * 1. regenerate(or move) the cursor remotely
 * 2. apply the selected text style remotely
 */
