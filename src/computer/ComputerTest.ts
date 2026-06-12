import { Computer } from "./Computer";
import MyFile from "./elements/File";
import { Folder } from "./elements/Folder";

export class ComputerTest {

    public static test01(): Computer {

        const computer = new Computer("192.168.0.1", "ruby");

        const mainFolder = new Folder("home");
        mainFolder.files = [new MyFile("test.txt", "ceci est un test")]

        computer.mainFolder = mainFolder;

        return computer;

    }

}