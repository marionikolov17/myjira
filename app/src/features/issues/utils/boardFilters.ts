import type { Issue } from '@/lib/api/schemas';
import type { BoardFilterValues } from '../useBoardFilters';

/** Apply board URL multi-select filters client-side. */
export function filterBoardIssues(issues: Issue[], values: BoardFilterValues): Issue[] {
  return issues.filter(
    (issue) =>
      (values.priority.length === 0 || values.priority.includes(issue.priority)) &&
      (values.assignee.length === 0 || values.assignee.includes(issue.assignee.id)),
  );
}
