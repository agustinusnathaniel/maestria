"maestria": major
---

Remove the `@maestria/omp` native executable and retire `maestria configure omp` per-agent models. `install`, `update`, `uninstall`, `check`, and `status` keep accepting `omp` and now stage the shared `@maestria/agent-plugins` portable skills with native `task()` dispatch. Session hooks, tool interception, review-mode enforcement, goal mirroring, and agent file deployment do not carry over; remove the retired package (`omp plugin uninstall @maestria/omp`) before installing.
