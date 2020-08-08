import { WarcraftServiceImpl } from "./warcraft.service.impl";
import { join } from 'path';
import { FileUtils } from "app/core/utils/file.utils";
import { WowClientType } from "app/models/warcraft/wow-client-type";

const BLIZZARD_AGENT_PATH = "/Users/Shared/Battle.net/Agent";
const BLIZZARD_PRODUCT_DB_NAME = "product.db";

export class WarcraftServiceMac implements WarcraftServiceImpl {

    public async getBlizzardAgentPath(): Promise<string> {
        const agentPath = join(name, BLIZZARD_AGENT_PATH, BLIZZARD_PRODUCT_DB_NAME);
        const exists = await FileUtils.exists(agentPath)
        return exists ? agentPath : '';
    }

    getExecutableName(clientType: WowClientType): string {
        throw new Error("Method not implemented.");
    }

}