import { Settings, Setting, MixinDeviceBase, ScryptedInterface } from "@scrypted/sdk";
import sdk from "@scrypted/sdk";

const { deviceManager } = sdk;

export interface SettingsMixinDeviceOptions {
    providerNativeId: string;
    mixinDeviceInterfaces: ScryptedInterface[];
    group: string;
    groupKey: string;
    mixinStorageSuffix?: string;
}

export abstract class SettingsMixinDeviceBase<T> extends MixinDeviceBase<T & Settings> implements Settings {
    settingsGroup: string;
    settingsGroupKey: string;

    constructor(mixinDevice: any, mixinDeviceState: { [key: string]: any }, options: SettingsMixinDeviceOptions) {
        super(mixinDevice, options.mixinDeviceInterfaces, mixinDeviceState, options.providerNativeId, options.mixinStorageSuffix);

        this.settingsGroup = options.group;
        this.settingsGroupKey = options.groupKey;
        process.nextTick(() => deviceManager.onMixinEvent(this.id, this, ScryptedInterface.Settings, null));
    }

    abstract getMixinSettings(): Promise<Setting[]>;
    abstract putMixinSetting(key: string, value: string | number | boolean): Promise<void>;

    async getSettings(): Promise<Setting[]> {
        const settingsPromise = this.mixinDeviceInterfaces.includes(ScryptedInterface.Settings) ? this.mixinDevice.getSettings() : undefined;
        const mixinSettingsPromise = this.getMixinSettings();
        const allSettings: Setting[] = [];

        try {
            const settings = (await settingsPromise) || [];
            allSettings.push(...settings);
        }
        catch (e) {
            const name = this.name;
            const description = `${name} Extension settings failed to load.`;
            this.console.error(description, e)
            allSettings.push({
                key: Math.random().toString(),
                title: name,
                value: 'Settings Error',
                group: 'Errors',
                description,
                readonly: true,
            });
        }

        try {
            const mixinSettings = (await mixinSettingsPromise) || [];
            for (const setting of mixinSettings) {
                setting.group = setting.group || this.settingsGroup;
                setting.key = this.settingsGroupKey + ':' + setting.key;
            }
            allSettings.push(...mixinSettings);
        }
        catch (e) {
            const name = deviceManager.getDeviceState(this.mixinProviderNativeId).name;
            const description = `${name} Extension settings failed to load.`;
            this.console.error(description, e)
            allSettings.push({
                key: Math.random().toString(),
                title: name,
                value: 'Settings Error',
                group: 'Errors',
                description,
                readonly: true,
            });
        }

        return allSettings;
    }

    async putSetting(key: string, value: string | number | boolean) {
        const prefix = this.settingsGroupKey + ':';
        if (!key?.startsWith(prefix)) {
            return this.mixinDevice.putSetting(key, value);
        }

        await this.putMixinSetting(key.substring(prefix.length), value)
        deviceManager.onMixinEvent(this.id, this, ScryptedInterface.Settings, null);
    }

    release() {
        deviceManager.onMixinEvent(this.id, this, ScryptedInterface.Settings, null);
    }
}
