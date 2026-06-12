import type { Command } from "../../types";

export const changeAuth: Command = async (args, context) => {
    const value = args[0];
    const password = args[1];

    if (!["admin", "user", "guest"].includes(value)) {
      context.ui.writeLine("Error command, usage: changeAuth <admin | user | guest> <?password>");
      return;
    }

    const computer = context.fs.getCurrentComputer();
    const currentAuth = computer.authority;

    const changeToAuth = (newAuth: "admin" | "user" | "guest") => {
      computer.authority = newAuth;
      context.ui.updatePrompt(context.getPromptToUpdate(), context.network.isCurrentlyConnected(), newAuth);
      context.ui.writeLine(`you are now connected as ${newAuth}`);
    };

    const checkPasswordAndChange = (targetAuth: "admin" | "user" | "guest", requiredPassword: string) => {
      if (requiredPassword === "") {
        changeToAuth(targetAuth);
        return true;
      }

      if (password && requiredPassword === password) {
        changeToAuth(targetAuth);
        return true;
      }

      context.ui.writeLine("Error wrong password, usage: changeAuth <admin | user | guest> <?password>");
      return false;
    };

    const targetAuth = value as "admin" | "user" | "guest";

    if (currentAuth === "admin") {
      changeToAuth(targetAuth);
      return;
    }

    switch (targetAuth) {
      case "admin":
        checkPasswordAndChange("admin", computer.passwordAuthAdmin);
        break;
      case "user":
        if (currentAuth === "user") {
          context.ui.writeLine("you are now connected as user");
        } else {
          checkPasswordAndChange("user", computer.passwordAuthUser);
        }
        break;
      case "guest":
        if (currentAuth === "guest") {
          context.ui.writeLine("you are now connected as guest");
        } else {
          changeToAuth("guest");
        }
        break;
    }
};
