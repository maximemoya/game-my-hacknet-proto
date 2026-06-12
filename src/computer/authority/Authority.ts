export type Authority = "guest" | "user" | "admin"
export function authorityCompare(authority: Authority, authorityAccess: Authority): boolean {
    if (authorityAccess === "admin") {
        return (authority === "admin")
    }
    else if (authorityAccess === "user") {
        return (authority === "user" || authority === "admin")
    }
    else {
        return true
    }
}