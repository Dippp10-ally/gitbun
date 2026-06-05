import inquirer from "inquirer";
import { colorizeCommitMessage } from "../utils/commitColors";

export async function confirmCommit(message: string): Promise<string | null> {
  console.log("\n" + colorizeCommitMessage(message) + "\n");

  const { action } = await inquirer.prompt([
    {
      type: "input",
      name: "action",
      message: "Accept commit? (Y/n/e)",
      default: "Y"
    }
  ]);

  const value = action.toLowerCase();

  if (value === "y" || value === "") return message;

  if (value === "e") {
    const { edited } = await inquirer.prompt([
      {
        type: "input",
        name: "edited",
        message: "Edit commit:",
        default: message
      }
    ]);
    return edited;
  }

  return null;
}
