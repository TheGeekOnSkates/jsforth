# JSForth

This is a Forth implementation in Javascript, with a REPL using [xterm.js](https://xtermjs.org/).
It started out as a student's college assignment; it only took a few hours to throw together, so
it's still very much a "work in progress". That said, it is pretty darn cool!  See manual.html
for the list of supported words, known bugs, and other fun stuff.




----------------------------------------------------------------------------------------------------------------

From here on down, it's all just low-level notes about the current project status; unless you're a programmer interested in contributing (and please, by all means do) there probably isn't much here of interest.

# To-do's for 0.2

In no particular order...

* Keep adding more standard Forth words - I know I can at least manage `C@` and `C!`; I'd kind of also like `pad`, `place`, and `+place` (though those are not part of "core" standards, they'd come in handy!)
* Maybe try again on `KEY`; my previous idea kinda worked, but was buggy as puck.  Until there's a word to exit out of an if-statement (what was it, `LEAVE`?) the only way to read keyboard input was in a `DO` loop, which caused recursion-related problems, etc... Since JS demands to be event-driven and callback-heavy, maybe an `ONKEY` word would be better :D
* If I feel like it, take another whack at the `."` bug
* Test all words, finish the manual, push to master and see where that PR goes :D

# Stuff that can wait for 0.3

* Known bug, no obvious solution, fight for another night: in `."` and `s"`, for reasons only God and the original dev would understand, if running inside a user-defined word, the last word get treated like a Forth word.  For example:

```
: test ." This is an example." ;
\ If I run my "test" word, it sees 'example."' as a word to be interpreted.  Since it's not in the dictionary, it shows an error.
\ Sense?  We don't need to make no steenkin' sense! :P #BugInTheJavaScript
\ https://www.youtube.com/watch?v=vINkWUe874c
```

* Multi-line definitions; i.e.
```
: myWord
	." Oh my word :D"
	cr
	." Oh wait, this wouldn't compile anyway till that bug is fixed"
;
```
* I"d also kinda like a nice editor for files in localStorage; probably not gonna build one in the terminal; I'm thinking a fancy one with something like CodeMirror :)
* Once I've got that, add `INCLUDE` (with support for URLs instead of just "files" in localStorage)
* Canvas, audio, gamepad, speech... these will probably be scripts and not built into the language itself, but still... if possible, would be nice.
* Any harder-to-add standard words, maybe some of the ones in "core extensions" (and also strings etc.).
