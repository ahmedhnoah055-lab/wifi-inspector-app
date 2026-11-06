(() => {
  "use strict";
  const STORE = "wifiInspector.multiRouter.v3";
  const $ = (id) => document.getElementById(id);
  let state = load();

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE) || '{"routers":[],"devices":[]}');
      return {
        routers: Array.isArray(parsed.routers) ? parsed.routers : [],
        devices: Array.isArray(parsed.devices) ? parsed.devices : []
      };
    } catch {
      return { routers: [], devices: [] };
    }
  }
  function save() {
    localStorage.setItem(STORE, JSON.stringify(state));
    render();
  }
  function id() {
    return (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  }
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function notify(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => toast.classList.remove("show"), 2600);
  }
  function methodName(method) {
    return ({unknown:"لم تحدد",web:"واجهة الويب",snmp:"SNMP",tr064:"TR-064",mikrotik:"MikroTik API",openwrt:"OpenWrt ubus"})[method] || "غير معروف";
  }
  // No vendor is treated as automatically supported until its adapter is implemented and tested.
  function supportState(router) {
    return "pending";
  }
  function render() {
    $("routerCount").textContent = state.routers.length;
    $("supportedCount").textContent = state.routers.filter(r => r.adapterReady === true).length;
    $("deviceCount").textContent = state.devices.length;
    $("emptyRouters").classList.toggle("hidden", state.routers.length > 0);
    $("emptyDevices").classList.toggle("hidden", state.devices.length > 0);

    $("routerList").innerHTML = state.routers.map(r => {
      const devices = state.devices.filter(d => d.routerId === r.id).length;
      const status = supportState(r);
      return `<article class="router-card">
        <div class="router-card-top"><div>
          <h3>${esc(r.name)}</h3>
          <div class="muted">${esc(r.brand)}${r.model ? " · " + esc(r.model) : ""}</div>
        </div><span class="tag pending">${status === "ready" ? "دعم مفعّل" : "بانتظار اختبار التوافق"}</span></div>
        <div class="router-meta">
          <span>IP: ${esc(r.ip || "غير محدد")}</span>
          <span>الاتصال: ${esc(methodName(r.method))}</span>
          <span>الأجهزة المسجلة: ${devices}</span>
        </div>
        ${r.notes ? `<p class="muted">${esc(r.notes)}</p>` : ""}
        <div class="card-actions">
          ${r.ip ? `<button class="secondary" data-open="${esc(r.id)}">فتح صفحة الراوتر</button>` : ""}
          <button class="secondary" data-edit="${esc(r.id)}">تعديل</button>
          <button class="secondary danger" data-delete="${esc(r.id)}">حذف</button>
        </div>
      </article>`;
    }).join("");

    $("deviceRouter").innerHTML = state.routers.map(r => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join("");
    $("showDeviceForm").disabled = state.routers.length === 0;
    $("deviceList").innerHTML = state.devices.map(d => {
      const router = state.routers.find(r => r.id === d.routerId);
      return `<article class="device-card">
        <strong>${esc(d.name)}</strong>
        <div class="muted">${esc(router?.name || "راوتر محذوف")} · ${esc(d.type || "نوع غير محدد")} · ${esc(d.ip || "IP غير محدد")}</div>
        <div class="card-actions"><button class="secondary danger" data-device-delete="${esc(d.id)}">حذف الجهاز</button></div>
      </article>`;
    }).join("");
  }

  function clearRouterForm() {
    $("routerForm").reset();
    $("routerForm").dataset.editId = "";
    $("routerForm").classList.add("hidden");
  }
  $("showRouterForm").addEventListener("click", () => {
    clearRouterForm();
    $("routerForm").classList.remove("hidden");
    $("routerName").focus();
  });
  $("cancelRouter").addEventListener("click", clearRouterForm);
  $("routerForm").addEventListener("submit", event => {
    event.preventDefault();
    const editId = $("routerForm").dataset.editId;
    const data = {
      name: $("routerName").value.trim(),
      brand: $("routerBrand").value,
      model: $("routerModel").value.trim(),
      ip: $("routerIp").value.trim(),
      method: $("routerMethod").value,
      notes: $("routerNotes").value.trim()
    };
    if (!data.name || !data.brand) return notify("أدخل اسم الراوتر والشركة.");
    if (data.ip && !/^(?=.{7,45}$)[0-9a-fA-F:.]+$/.test(data.ip)) return notify("تحقق من عنوان IP.");
    if (editId) {
      const item = state.routers.find(r => r.id === editId);
      if (item) Object.assign(item, data);
      notify("تم تحديث بيانات الراوتر.");
    } else {
      state.routers.push({ id: id(), ...data, createdAt: new Date().toISOString(), adapterReady: false });
      notify("تمت إضافة الراوتر إلى القائمة.");
    }
    save();
    clearRouterForm();
  });

  $("routerList").addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    const r = state.routers.find(x => x.id === (button.dataset.edit || button.dataset.delete || button.dataset.open));
    if (!r) return;
    if (button.dataset.open) {
      if (!r.ip) return notify("أدخل عنوان IP أولاً.");
      const address = /^https?:\/\//i.test(r.ip) ? r.ip : `http://${r.ip}`;
      window.open(address, "_blank", "noopener,noreferrer");
    } else if (button.dataset.edit) {
      $("routerName").value = r.name;
      $("routerBrand").value = r.brand;
      $("routerModel").value = r.model || "";
      $("routerIp").value = r.ip || "";
      $("routerMethod").value = r.method || "unknown";
      $("routerNotes").value = r.notes || "";
      $("routerForm").dataset.editId = r.id;
      $("routerForm").classList.remove("hidden");
      $("routerName").focus();
      window.scrollTo({top: $("routerForm").getBoundingClientRect().top + window.scrollY - 15, behavior:"smooth"});
    } else if (button.dataset.delete) {
      if (!confirm(`هل تريد حذف الراوتر "${r.name}"؟ سيتم حذف الأجهزة المسجلة تحته أيضاً.`)) return;
      state.routers = state.routers.filter(x => x.id !== r.id);
      state.devices = state.devices.filter(d => d.routerId !== r.id);
      save();
      notify("تم حذف الراوتر والأجهزة التابعة له.");
    }
  });

  $("showDeviceForm").addEventListener("click", () => {
    if (!state.routers.length) return notify("أضف راوتراً أولاً.");
    $("deviceForm").classList.remove("hidden");
  });
  $("cancelDevice").addEventListener("click", () => {
    $("deviceForm").reset();
    $("deviceForm").classList.add("hidden");
  });
  $("deviceForm").addEventListener("submit", event => {
    event.preventDefault();
    const data = {
      id: id(),
      routerId: $("deviceRouter").value,
      name: $("deviceName").value.trim(),
      ip: $("deviceIp").value.trim(),
      type: $("deviceType").value.trim()
    };
    if (!data.routerId || !data.name) return notify("اختر الراوتر واكتب اسم الجهاز.");
    state.devices.push(data);
    save();
    $("deviceForm").reset();
    $("deviceForm").classList.add("hidden");
    notify("تم حفظ الجهاز.");
  });
  $("deviceList").addEventListener("click", event => {
    const button = event.target.closest("[data-device-delete]");
    if (!button) return;
    state.devices = state.devices.filter(d => d.id !== button.dataset.deviceDelete);
    save();
    notify("تم حذف الجهاز.");
  });

  $("exportData").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({version:3, exportedAt:new Date().toISOString(), ...state}, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "wifi-inspector-backup.json"; a.click();
    URL.revokeObjectURL(url);
  });
  $("importData").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.routers) || !Array.isArray(parsed.devices)) throw new Error("invalid");
      if (!confirm("سيتم استبدال القائمة الحالية بالنسخة المحددة. هل تريد المتابعة؟")) return;
      state = {
        routers: parsed.routers.filter(r => r && r.id && r.name && r.brand),
        devices: parsed.devices.filter(d => d && d.id && d.name && d.routerId)
      };
      save();
      notify("تمت استعادة النسخة الاحتياطية.");
    } catch {
      notify("الملف غير صالح أو ليس نسخة احتياطية من التطبيق.");
    } finally {
      event.target.value = "";
    }
  });

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
  }
  render();
})();