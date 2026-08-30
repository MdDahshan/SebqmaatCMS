import { useForm, Controller } from "react-hook-form";
import { open } from "@tauri-apps/plugin-dialog";
import { ActionFooter } from "../layout/ActionFooter";

interface DynamicFormProps {
  initialData: any;
  activeTab: string;
  onSave: (data: any) => void;
  onDiscard: () => void;
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function RecursiveField({
  name,
  value,
  control,
  level = 0,
}: {
  name: string;
  value: any;
  control: any;
  level?: number;
}) {
  const type = typeof value;
  const fieldName = name ? capitalize(name.split(".").pop() || "") : "General Details";

  const isMultiline = type === "string" && (value.length > 50 || value.includes("\n"));
  const isUrl = type === "string" && (
    value.startsWith("http://") || 
    value.startsWith("https://") ||
    name.toLowerCase().includes("url") ||
    name.toLowerCase().includes("link") ||
    name.toLowerCase().includes("website")
  );

  const isPath = type === "string" && !isUrl && (
    name.toLowerCase().includes("image") || 
    name.toLowerCase().includes("path") || 
    name.toLowerCase().includes("file") || 
    name.toLowerCase().includes("icon")
  );

  if (type === "string") {
    return (
      <div className="flex flex-col gap-2">
        <label className="text-[13px] font-medium text-text-primary flex items-center gap-2">
          {fieldName}
          <span className="text-[10px] font-normal text-text-muted">String</span>
        </label>
        <Controller
          name={name}
          control={control}
          render={({ field }) =>
            isPath ? (
              <div className="flex gap-2 w-full md:max-w-2xl">
                <input
                  {...field}
                  type="text"
                  className="bg-transparent border border-white/10 rounded-md h-[36px] px-3 text-[13px] text-white hover:border-white/20 focus:border-white/40 focus:outline-none transition-all w-full backdrop-blur-sm"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const selected = await open({ multiple: false });
                    if (selected && typeof selected === "string") {
                      field.onChange(selected);
                    }
                  }}
                  className="shrink-0 px-3 h-[36px] rounded-md bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors flex items-center justify-center backdrop-blur-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">folder</span>
                </button>
              </div>
            ) : isMultiline ? (
              <textarea
                {...field}
                className="bg-transparent border border-white/10 rounded-md p-3 text-[13px] text-white hover:border-white/20 focus:border-white/40 focus:outline-none transition-all min-h-[100px] w-full backdrop-blur-sm"
              />
            ) : (
              <input
                {...field}
                type="text"
                className="bg-transparent border border-white/10 rounded-md h-[36px] px-3 text-[13px] text-white hover:border-white/20 focus:border-white/40 focus:outline-none transition-all w-full md:max-w-xl backdrop-blur-sm"
              />
            )
          }
        />
      </div>
    );
  }

  if (type === "boolean") {
    return (
      <div className="flex flex-col gap-2">
        <label className="text-[13px] font-medium text-text-primary flex items-center gap-2">
          {fieldName}
          <span className="text-[10px] font-normal text-text-muted">Boolean</span>
        </label>
        <div className="flex items-center h-[36px] w-full md:max-w-xl">
          <div className="relative inline-block w-9 mr-2 align-middle select-none transition duration-200 ease-in">
            <Controller
              name={name}
              control={control}
              render={({ field }) => (
                <>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    id={`toggle-${name}`}
                    className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 border-background appearance-none cursor-pointer z-10 transition-transform duration-200 ease-in-out top-0.5 left-0.5"
                  />
                  <label
                    htmlFor={`toggle-${name}`}
                    className="toggle-label block overflow-hidden h-5 rounded-full bg-white/20 cursor-pointer text-[0px] backdrop-blur-sm"
                  >
                    Toggle
                  </label>
                </>
              )}
            />
          </div>
        </div>
      </div>
    );
  }

  if (type === "number") {
    return (
      <div className="flex flex-col gap-2">
        <label className="text-[13px] font-medium text-text-primary flex items-center gap-2">
          {fieldName}
          <span className="text-[10px] font-normal text-text-muted">Number</span>
        </label>
        <Controller
          name={name}
          control={control}
          render={({ field }) => (
            <input
              type="number"
              {...field}
              onChange={(e) => field.onChange(Number(e.target.value))}
              className="bg-transparent border border-white/10 rounded-md h-[36px] px-3 text-[13px] text-white hover:border-white/20 focus:border-white/40 focus:outline-none transition-all w-full md:max-w-xl backdrop-blur-sm"
            />
          )}
        />
      </div>
    );
  }

  if (Array.isArray(value)) {
    const isTabContent = level === 0;
    return (
      <div className={`flex flex-col w-full ${isTabContent ? '' : 'mt-4'}`}>
        <div className="flex justify-between items-center pb-2">
          <h3 className="text-[15px] font-semibold text-white">
            {isTabContent ? capitalize(name.split(".").pop()?.replace(/_/g, " ") || "") : fieldName}
          </h3>
          <button type="button" className="text-[12px] font-medium bg-transparent hover:bg-white/5 text-text-primary px-2 py-1 rounded transition-colors flex items-center gap-1 border border-transparent hover:border-white/10 backdrop-blur-sm">
            <span className="material-symbols-outlined text-[14px]">add</span> Add Item
          </button>
        </div>
        <div className={`flex flex-col gap-6 mt-2 ${isTabContent ? '' : 'border-l-2 border-white/10 ml-[1px] pl-5'}`}>
          {value.map((item, index) => (
            <div key={index} className="relative group w-full pt-1 pb-3">
              <button type="button" className="absolute top-0 right-0 text-white/30 hover:text-red-400 bg-transparent p-1 rounded opacity-0 group-hover:opacity-100 transition-all z-10 backdrop-blur-sm">
                <span className="material-symbols-outlined text-[16px] block">delete</span>
              </button>
              <div className="flex-1 w-full">
                 <RecursiveField
                    name={`${name}.${index}`}
                    value={item}
                    control={control}
                    level={level + 1}
                  />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "object" && value !== null) {
    const isTabContent = level === 0;

    return (
      <div className={`w-full ${isTabContent ? 'flex flex-col gap-8' : 'mt-4'}`}>
        {!isTabContent && (
          <h3 className="text-[15px] font-semibold text-white pb-2">
            {fieldName}
          </h3>
        )}
        <div className={`flex flex-col gap-6 ${isTabContent ? '' : 'border-l-2 border-white/10 ml-[1px] pl-5 pt-2'}`}>
          {Object.entries(value).map(([key, val]) => (
            <RecursiveField
              key={key}
              name={name ? `${name}.${key}` : key}
              value={val}
              control={control}
              level={level + 1}
            />
          ))}
        </div>
      </div>
    );
  }

  return null;
}

export function DynamicForm({ initialData, activeTab, onSave, onDiscard }: DynamicFormProps) {
  const { control, handleSubmit, reset, formState: { isDirty } } = useForm({
    defaultValues: initialData,
  });

  const onSubmit = (data: any) => {
    onSave(data);
    reset(data);
  };

  const handleDiscard = () => {
    reset(initialData);
    onDiscard();
  };

  if (!initialData || Object.keys(initialData).length === 0) {
    return <p className="text-text-muted">No editable data found.</p>;
  }

  const isSingleField = (val: any) => {
    if (val === null || typeof val !== 'object') return true;
    if (Array.isArray(val)) return false;
    return Object.keys(val).length === 1;
  };

  const keys = Object.keys(initialData);
  const groupedKeys = keys.filter(k => isSingleField(initialData[k]));
  const complexKeys = keys.filter(k => !isSingleField(initialData[k]));

  return (
    <div className="flex-1 flex flex-col justify-between h-full relative">
      <form id="dynamic-editor-form" onSubmit={handleSubmit(onSubmit)} className="w-full flex flex-col h-full overflow-hidden">
        {/* Tabs Content */}
        <div className="p-6 overflow-y-auto flex-1 pb-32">
          {groupedKeys.length > 0 && (
            <div className={activeTab === '__general__' ? "block" : "hidden"}>
              <div className="flex flex-col">
                {groupedKeys.map((key, index) => (
                  <div key={key}>
                    <RecursiveField name={key} value={initialData[key]} control={control} level={0} />
                    {index < groupedKeys.length - 1 && (
                      <hr className="my-8 border-white/5" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {complexKeys.map(key => (
            <div key={key} className={activeTab === key ? "block" : "hidden"}>
              <RecursiveField name={key} value={initialData[key]} control={control} level={0} />
            </div>
          ))}
        </div>
      </form>
      
      {isDirty && (
        <ActionFooter 
          isDirty={isDirty}
          onSave={handleSubmit(onSubmit)}
          onDiscard={handleDiscard}
        />
      )}
    </div>
  );
}
