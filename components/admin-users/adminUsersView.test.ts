import { describe, expect, it } from "vitest";

import { filterUsers, initialsFor, needsDemoteConfirm, sortUsers, userStats, type AdminUser } from "./adminUsersView";

const user = (over: Partial<AdminUser>): AdminUser => ({
  userId: "id",
  email: "a@x.com",
  role: "Supervisor",
  designation: null,
  mustChangePassword: false,
  ...over,
});

const users: AdminUser[] = [
  user({ userId: "1", email: "pgovind@gmail.com", role: "Admin" }),
  user({ userId: "2", email: "shyam@yahoo.com", role: "Supervisor", designation: "Site Engineer", mustChangePassword: true }),
  user({ userId: "3", email: "bharath@gmail.com", role: "Admin", designation: "Tech Lead" }),
];

describe("filterUsers", () => {
  it("returns everyone for an empty search and the All filter", () => {
    expect(filterUsers(users, "", "all")).toHaveLength(3);
  });

  it("matches the email case-insensitively", () => {
    expect(filterUsers(users, "SHYAM", "all").map((u) => u.userId)).toEqual(["2"]);
  });

  it("matches the designation", () => {
    expect(filterUsers(users, "tech", "all").map((u) => u.userId)).toEqual(["3"]);
  });

  it("filters by role", () => {
    expect(filterUsers(users, "", "Admin").map((u) => u.userId)).toEqual(["1", "3"]);
  });

  it("filters to accounts still on a temp password", () => {
    expect(filterUsers(users, "", "pending").map((u) => u.userId)).toEqual(["2"]);
  });

  it("combines search and filter", () => {
    expect(filterUsers(users, "gmail", "Admin").map((u) => u.userId)).toEqual(["1", "3"]);
    expect(filterUsers(users, "yahoo", "Admin")).toEqual([]);
  });

  it("still searches a user whose email could not be loaded", () => {
    const noEmail = user({ userId: "9", email: null, designation: "Foreman" });
    expect(filterUsers([noEmail], "fore", "all")).toEqual([noEmail]);
  });
});

describe("userStats", () => {
  it("counts accounts, roles and pending setups", () => {
    expect(userStats(users)).toEqual({ total: 3, admins: 2, supervisors: 1, pending: 1 });
  });
});

describe("sortUsers", () => {
  it("sorts by email A→Z with missing emails last", () => {
    const sorted = sortUsers([...users, user({ userId: "9", email: null })]);
    expect(sorted.map((u) => u.userId)).toEqual(["3", "1", "2", "9"]);
  });

  it("does not mutate its input", () => {
    const input = [...users];
    sortUsers(input);
    expect(input.map((u) => u.userId)).toEqual(["1", "2", "3"]);
  });
});

describe("initialsFor", () => {
  it("takes two letters from the email name", () => {
    expect(initialsFor("pgovind110896@gmail.com")).toBe("PG");
  });

  it("uses the first letters of dotted names", () => {
    expect(initialsFor("shyam.prasad@yahoo.com")).toBe("SP");
  });

  it("falls back when there is no email", () => {
    expect(initialsFor(null)).toBe("?");
  });
});

describe("needsDemoteConfirm", () => {
  it("confirms taking admin away from someone", () => {
    expect(needsDemoteConfirm("Admin", "Supervisor")).toBe(true);
  });

  it("does not confirm a promotion or a no-op", () => {
    expect(needsDemoteConfirm("Supervisor", "Admin")).toBe(false);
    expect(needsDemoteConfirm("Admin", "Admin")).toBe(false);
  });
});
