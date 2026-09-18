## 18-09-2026

### Integration tests

For each route a good and consistent way to structure each describe block (for each response branch under it) is going to be in order of the response code - starting from 200, 400, then 401, 403 and finally wrapping up with 500 failures.
