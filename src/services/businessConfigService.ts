import { BusinessConfig } from "../models/BusinessConfig";

const BUSINESS_CONFIG_KEY = "business";

export const saveBusinessQris = async (image: Buffer) => {
  return await BusinessConfig.findOneAndUpdate(
    { key: BUSINESS_CONFIG_KEY },
    { $set: { qrisImage: image } },
    { new: true, upsert: true }
  );
};

export const getBusinessQris = async () => {
  const config = await BusinessConfig.findOne({ key: BUSINESS_CONFIG_KEY }).select("qrisImage");
  return config?.qrisImage ? Buffer.from(config.qrisImage) : null;
};

export const deleteBusinessQris = async () => {
  await BusinessConfig.deleteOne({ key: BUSINESS_CONFIG_KEY });
};
