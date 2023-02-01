# TO-DO's

In no particular order...

* Fix the bug in `."` (and potentially all the other string-handling functions; for some reason, if I do i.e. `: test ." AaBbCc" ;` the capital letters are getting lowercased).  Probably because it's in compile mode and not run mode (`."` works fine in run mode)
* Finish tweaking my input event handler; the Backspace bug is fixed, but I'd like to add some nicer features.
* Once I do that, may as well add `KEY`
* Check if 0.1 supported multi-line definitions; if so, get it working on my end.
* Keep adding more standard Forth words
* Test all words, and finish the manual
* Push to master, submit a PR and see if he goes for it.  Either way, keep on going FORTH! :)
