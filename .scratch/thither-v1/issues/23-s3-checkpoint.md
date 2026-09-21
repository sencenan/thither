# S3 checkpoint: dogfood the live shortcut

Type: grilling
Status: open
Blocked by: 22

## Question

Human review of Thither as a deployed tool, driven from their own browser's address bar — the first time the thing is used the way it is meant to be used.

Have the human configure the search shortcut from ticket 22's templates, in their real browser, and then live with it: set their actual targets, navigate to them by dimension, pass arguments, and try the fragment form as well as the query form. This is where `%s` substitution problems with `#`, `&`, and `+` will first appear; note what breaks, since S6's checklist is written from these observations.

Judge: does the shortcut contract hold up, is the single-file artifact behaving on Pages as ADR-0002 assumed, and is the fallback page tolerable enough to use daily while S4 and S5 are built? Anything intolerable becomes a ticket now rather than waiting for S5.

Note that the scheme-policy question is **closed** and deliberately not reopened here.

**Done when** the human is using the deployed Thither from their address bar, and any blocking defect found is ticketed.
