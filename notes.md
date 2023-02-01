# To-do's for 0.2

In no particular order...

* Fix the bug in `."` (and potentially all the other string-handling functions; for some reason, if I do i.e. `: test ." AaBbCc" ;` the capital letters are getting lowercased).  Probably because it's in compile mode and not run mode (`."` works fine in run mode)
* Finish tweaking my input event handler; the Backspace bug is fixed, but I'd like to add some nicer features.
* Once I do that, may as well add `KEY`
* Keep adding more standard Forth words
* Test all words, finish the manual (btw figure out whether words should use an H2 or H3), push to master and see where that PR goes :D

# Stuff that can wait for 0.3

* Multi-line definitions
* I"d also kinda like a nice editor for files in localStorage; probably not gonna build one in the terminal; I'm thinking a fancy one with something like CodeMirror :)
* Once I've got that, add `INCLUDE` (with support for URLs instead of just "files" in localStorage)
* Canvas, audio, gamepad, speech... these will probably be scripts and not built into the language itself, but still... if possible, would be nice.
* Any harder-to-add standard words, maybe some of the ones in "core extensions" (and also strings etc.).
