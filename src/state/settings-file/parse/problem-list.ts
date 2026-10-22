import { errorMessage } from "../../../lib/errors.ts";
import { MAX_LISTED_PROBLEMS } from "../constants.ts";

export class ProblemList {
  private readonly problems: string[] = [];

  add(problem: string): void {
    this.problems.push(problem);
  }

  attempt<T>(label: string, fn: () => T): T | undefined {
    try {
      return fn();
    } catch (err) {
      this.add(`${label}: ${errorMessage(err)}`);
      return undefined;
    }
  }

  throwIfAny(): void {
    if (this.problems.length === 0) return;
    const listed = this.problems.slice(0, MAX_LISTED_PROBLEMS).join("; ");
    const more = this.problems.length - MAX_LISTED_PROBLEMS;
    throw new Error(
      `The settings file can't be imported. ${listed}${more > 0 ? `; and ${more} more` : ""}.`,
    );
  }
}
