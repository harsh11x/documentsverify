"use strict";(()=>{var e={};e.id=665,e.ids=[665],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},297:(e,t,n)=>{n.r(t),n.d(t,{originalPathname:()=>m,patchFetch:()=>b,requestAsyncStorage:()=>f,routeModule:()=>y,serverHooks:()=>v,staticGenerationAsyncStorage:()=>g});var a={};n.r(a),n.d(a,{GET:()=>s});var r=n(3277),i=n(5265),o=n(5356);let l=require("node:fs/promises"),c=require("node:path");var p=n.n(c),u=n(7076);let d={"verify-truth":"verify-truth-monolithic-hero.html","certificate-verification":"certificate-verification.html","register-organization":"register-organization.html","digital-certificate-view":"digital-certificate-view.html"};async function s(e,{params:t}){let n=d[t.slug];if(!n)return new u.NextResponse("Not found",{status:404});let a=p().resolve(process.cwd(),"..","stitch-export","code",n);try{let e=await (0,l.readFile)(a,"utf8"),n=function(e,t){let n=process.env.NEXT_PUBLIC_API_URL||"http://localhost:4000",a=`
<script>
  (function () {
    var pageSlug = ${JSON.stringify(t)};
    var apiBaseUrl = ${JSON.stringify(n)};

    function textContent(el) {
      return (el && el.textContent ? el.textContent : "").replace(/\\s+/g, " ").trim().toLowerCase();
    }

    function navigate(path) {
      try {
        var currentPath = window.parent && window.parent !== window ? window.parent.location.pathname : window.location.pathname;
        if (currentPath === path) return;
      } catch (_err) {}

      if (window.parent && window.parent !== window) {
        window.parent.location.href = path;
        return;
      }
      window.location.href = path;
    }

    function bindButtonByLabel(label, path) {
      var buttons = document.querySelectorAll("button");
      for (var i = 0; i < buttons.length; i += 1) {
        var btn = buttons[i];
        if (textContent(btn).indexOf(label) !== -1) {
          btn.addEventListener("click", function (event) {
            event.preventDefault();
            navigate(path);
          });
        }
      }
    }

    function bindLinkByLabel(label, path) {
      var links = document.querySelectorAll("a");
      for (var i = 0; i < links.length; i += 1) {
        var link = links[i];
        if (textContent(link) === label || textContent(link).indexOf(label) !== -1) {
          link.setAttribute("href", path);
          link.addEventListener("click", function (event) {
            event.preventDefault();
            navigate(path);
          });
        }
      }
    }

    function bindLabelNavigationDelegation() {
      var navMap = {
        platform: "/",
        ledger: "/certificate-verification",
        ecosystem: "/register-organization",
        docs: "/digital-certificate-view",
        whitepaper: "/whitepaper",
        transparency: "/transparency",
        contact: "/contact",
        legal: "/legal",
        connect: "/connect",
        governance: "/governance"
      };

      document.addEventListener(
        "click",
        function (event) {
          var target = event.target;
          if (!target || !target.closest) return;
          var clickable = target.closest("a, button, span, div");
          if (!clickable) return;
          var label = textContent(clickable);
          var entries = Object.entries(navMap);
          for (var i = 0; i < entries.length; i += 1) {
            var key = entries[i][0];
            var route = entries[i][1];
            if (label === key || label.indexOf(key) !== -1) {
              event.preventDefault();
              navigate(route);
              return;
            }
          }
        },
        true
      );
    }

    function bindBrandToHome() {
      var brandCandidates = document.querySelectorAll("span, div");
      for (var i = 0; i < brandCandidates.length; i += 1) {
        var el = brandCandidates[i];
        if (textContent(el) === "verify_ledger") {
          el.style.cursor = "pointer";
          el.addEventListener("click", function (event) {
            event.preventDefault();
            navigate("/");
          });
        }
      }
    }

    function replaceWalletWithAuthActions() {
      var spans = document.querySelectorAll("span");
      for (var i = 0; i < spans.length; i += 1) {
        var value = textContent(spans[i]);
        if (value.indexOf("wallet:") !== -1) {
          var wrapper = spans[i].parentElement;
          if (!wrapper || wrapper.getAttribute("data-auth-actions") === "1") continue;
          wrapper.setAttribute("data-auth-actions", "1");
          wrapper.innerHTML = "";
          wrapper.style.gap = "8px";
          wrapper.style.padding = "0";
          wrapper.style.border = "none";
          wrapper.style.background = "transparent";

          var loginBtn = document.createElement("button");
          loginBtn.type = "button";
          loginBtn.textContent = "Log In";
          loginBtn.style.padding = "8px 12px";
          loginBtn.style.fontSize = "11px";
          loginBtn.style.fontWeight = "700";
          loginBtn.style.letterSpacing = "0.08em";
          loginBtn.style.textTransform = "uppercase";
          loginBtn.style.border = "1px solid #cbd5e1";
          loginBtn.style.background = "#ffffff";
          loginBtn.style.cursor = "pointer";

          var signupBtn = document.createElement("button");
          signupBtn.type = "button";
          signupBtn.textContent = "Sign Up";
          signupBtn.style.padding = "8px 12px";
          signupBtn.style.fontSize = "11px";
          signupBtn.style.fontWeight = "700";
          signupBtn.style.letterSpacing = "0.08em";
          signupBtn.style.textTransform = "uppercase";
          signupBtn.style.border = "1px solid #1f2937";
          signupBtn.style.background = "#1f2937";
          signupBtn.style.color = "#ffffff";
          signupBtn.style.cursor = "pointer";

          loginBtn.addEventListener("click", function (event) {
            event.preventDefault();
            navigate("/login");
          });
          signupBtn.addEventListener("click", function (event) {
            event.preventDefault();
            navigate("/signup");
          });

          wrapper.appendChild(loginBtn);
          wrapper.appendChild(signupBtn);
        }
      }
    }

    function bindRegisterOrganizationInteractions() {
      if (pageSlug !== "register-organization") return;

      function fieldByLabel(labelNeedle) {
        var groups = document.querySelectorAll("div.space-y-2");
        for (var idx = 0; idx < groups.length; idx += 1) {
          var label = groups[idx].querySelector("label");
          var input = groups[idx].querySelector("input, select");
          if (!label || !input) continue;
          if (textContent(label).indexOf(labelNeedle) !== -1) return input;
        }
        return null;
      }

      var orgNameInput = fieldByLabel("organization name");
      var entityTypeSelect = fieldByLabel("entity type");
      var registrationNumberInput = fieldByLabel("registration number");
      var countryField = fieldByLabel("country");
      var proceedButton = Array.from(document.querySelectorAll("button")).find(function (btn) {
        return textContent(btn).indexOf("proceed to review") !== -1;
      });

      if (!orgNameInput || !entityTypeSelect || !registrationNumberInput || !countryField || !proceedButton) {
        return;
      }

      var selectedCountryName = "";
      var selectedStateName = "";

      var countryInput = countryField;
      if (countryField && countryField.tagName.toLowerCase() === "input") {
        var countrySelect = document.createElement("select");
        countrySelect.className = countryField.className;
        countrySelect.style.border = countryField.style.border;
        countrySelect.style.padding = countryField.style.padding;
        countrySelect.innerHTML = "<option value=''>Loading countries...</option>";
        countryField.parentElement?.replaceChild(countrySelect, countryField);
        countryInput = countrySelect;
      }

      var stateInput = document.createElement("select");
      stateInput.className = countryInput.className;
      stateInput.style.border = countryInput.style.border;
      stateInput.style.padding = countryInput.style.padding;
      stateInput.innerHTML = "<option value=''>Select State</option>";
      stateInput.disabled = true;

      var cityInput = document.createElement("select");
      cityInput.className = countryInput.className;
      cityInput.style.border = countryInput.style.border;
      cityInput.style.padding = countryInput.style.padding;
      cityInput.innerHTML = "<option value=''>Select City</option>";
      cityInput.disabled = true;

      function createFieldBlock(labelText, field) {
        var wrapper = document.createElement("div");
        wrapper.className = "space-y-2";
        var label = document.createElement("label");
        label.className = "text-[10px] uppercase font-bold tracking-widest text-on-surface-variant";
        label.textContent = labelText;
        wrapper.appendChild(label);
        wrapper.appendChild(field);
        return wrapper;
      }

      var countryGroup = countryInput.parentElement;
      var grid = countryGroup ? countryGroup.parentElement : null;
      if (grid) {
        var stateBlock = createFieldBlock("State", stateInput);
        var cityBlock = createFieldBlock("City", cityInput);
        grid.appendChild(stateBlock);
        grid.appendChild(cityBlock);
      }

      async function loadCountries() {
        try {
          var response = await fetch("/api/locations");
          var data = await response.json();
          var countries = data.countries || [];
          countryInput.innerHTML = "<option value=''>Select Country</option>";
          countries.forEach(function (country) {
            var option = document.createElement("option");
            option.value = country.code;
            option.textContent = country.name;
            countryInput.appendChild(option);
          });
        } catch (_err) {
          countryInput.innerHTML = "<option value=''>Could not load countries</option>";
        }
      }

      countryInput.addEventListener("change", async function () {
        var selectedCountry = countryInput.value ? String(countryInput.value) : "";
        selectedCountryName = countryInput.options[countryInput.selectedIndex]?.text || "";
        stateInput.innerHTML = "<option value=''>Select State</option>";
        cityInput.innerHTML = "<option value=''>Select City</option>";
        cityInput.disabled = true;
        selectedStateName = "";
        if (!selectedCountry) {
          stateInput.disabled = true;
          return;
        }
        try {
          var response = await fetch("/api/locations?countryCode=" + encodeURIComponent(selectedCountry));
          var data = await response.json();
          var states = data.states || [];
          states.forEach(function (state) {
            var option = document.createElement("option");
            option.value = state.code;
            option.textContent = state.name;
            stateInput.appendChild(option);
          });
          stateInput.disabled = false;
        } catch (_err) {
          stateInput.disabled = true;
        }
      });

      stateInput.addEventListener("change", async function () {
        var selectedCountry = countryInput.value ? String(countryInput.value) : "";
        var selectedState = stateInput.value ? String(stateInput.value) : "";
        selectedStateName = stateInput.options[stateInput.selectedIndex]?.text || "";
        cityInput.innerHTML = "<option value=''>Select City</option>";
        if (!selectedCountry || !selectedState) {
          cityInput.disabled = true;
          return;
        }
        try {
          var response = await fetch(
            "/api/locations?countryCode=" +
              encodeURIComponent(selectedCountry) +
              "&stateCode=" +
              encodeURIComponent(selectedState)
          );
          var data = await response.json();
          var cities = data.cities || [];
          cities.forEach(function (city) {
            var option = document.createElement("option");
            option.value = city.name;
            option.textContent = city.name;
            cityInput.appendChild(option);
          });
          cityInput.disabled = false;
        } catch (_err) {
          cityInput.disabled = true;
        }
      });
      void loadCountries();

      var actionContainer = proceedButton.parentElement;
      if (!actionContainer) return;

      var helperWrap = document.createElement("div");
      helperWrap.style.display = "flex";
      helperWrap.style.flexDirection = "column";
      helperWrap.style.gap = "8px";
      helperWrap.style.marginRight = "12px";

      var adminEmailInput = document.createElement("input");
      adminEmailInput.type = "email";
      adminEmailInput.placeholder = "Admin email (required)";
      adminEmailInput.style.minWidth = "260px";
      adminEmailInput.style.padding = "10px 12px";
      adminEmailInput.style.border = "1px solid #d1d5db";
      adminEmailInput.style.background = "#ffffff";
      adminEmailInput.style.fontSize = "13px";

      var adminPhoneInput = document.createElement("input");
      adminPhoneInput.type = "tel";
      adminPhoneInput.placeholder = "Mobile number (required)";
      adminPhoneInput.style.minWidth = "260px";
      adminPhoneInput.style.padding = "10px 12px";
      adminPhoneInput.style.border = "1px solid #d1d5db";
      adminPhoneInput.style.background = "#ffffff";
      adminPhoneInput.style.fontSize = "13px";

      var feedback = document.createElement("div");
      feedback.style.fontSize = "12px";
      feedback.style.fontWeight = "600";
      feedback.style.minHeight = "16px";
      feedback.style.color = "#374151";

      helperWrap.appendChild(adminEmailInput);
      helperWrap.appendChild(adminPhoneInput);
      helperWrap.appendChild(feedback);
      actionContainer.insertBefore(helperWrap, proceedButton);

      proceedButton.addEventListener("click", async function (event) {
        event.preventDefault();
        var orgName = orgNameInput.value ? String(orgNameInput.value).trim() : "";
        var entityType = entityTypeSelect.value ? String(entityTypeSelect.value).trim() : "";
        var registrationNumber = registrationNumberInput.value ? String(registrationNumberInput.value).trim() : "";
        var country = countryInput.value ? String(countryInput.value).trim() : "";
        var state = stateInput.value ? String(stateInput.value).trim() : "";
        var city = cityInput.value ? String(cityInput.value).trim() : "";
        var adminEmail = adminEmailInput.value ? String(adminEmailInput.value).trim() : "";
        var adminPhone = adminPhoneInput.value ? String(adminPhoneInput.value).trim() : "";

        if (!orgName || !entityType || !registrationNumber || !country || !state || !city || !adminEmail || !adminPhone) {
          feedback.textContent = "All details are required: country, state, city, org details, email and mobile number.";
          feedback.style.color = "#b91c1c";
          return;
        }
        if (!/^\\+?[0-9]{8,15}$/.test(adminPhone)) {
          feedback.textContent = "Please enter a valid mobile number.";
          feedback.style.color = "#b91c1c";
          return;
        }

        var orgType = entityType.toLowerCase().indexOf("government") !== -1 ? "GOV" : "PVT";
        var payload = {
          name: orgName,
          countryName: selectedCountryName || country,
          stateName: selectedStateName || state,
          city: city,
          orgType: orgType,
          sector: (entityType || "General") + " | " + (selectedStateName || state) + ", " + (selectedCountryName || country),
          domain: registrationNumber,
          adminEmail: adminEmail,
          adminPhone: adminPhone
        };

        feedback.textContent = "Submitting organization application...";
        feedback.style.color = "#374151";
        proceedButton.disabled = true;
        proceedButton.style.opacity = "0.7";

        try {
          var response = await fetch(apiBaseUrl.replace(/\\/$/, "") + "/api/org/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          var data = await response.json();
          if (!response.ok) {
            feedback.textContent = "Submission failed. Check details and try again.";
            feedback.style.color = "#b91c1c";
            console.error("org_register_failed", data);
            return;
          }
          feedback.textContent = "Submitted successfully. Org ID: " + (data.orgId || "generated");
          feedback.style.color = "#065f46";
        } catch (err) {
          feedback.textContent = "Backend unreachable. Please try again.";
          feedback.style.color = "#b91c1c";
          console.error("org_register_error", err);
        } finally {
          proceedButton.disabled = false;
          proceedButton.style.opacity = "1";
        }
      });
    }

    function bindVerifyPageInteractions() {
      if (pageSlug !== "certificate-verification") return;

      var form = document.querySelector("form");
      var selectEl = form ? form.querySelector("select") : null;
      var identifierInput = form ? form.querySelector("input[type='text']") : null;
      var executeButton = null;
      var buttons = document.querySelectorAll("button");
      var exportButton = null;
      var publicLinkButton = null;

      for (var i = 0; i < buttons.length; i += 1) {
        var buttonText = textContent(buttons[i]);
        if (buttonText.indexOf("execute query") !== -1) executeButton = buttons[i];
        if (buttonText.indexOf("export pdf") !== -1) exportButton = buttons[i];
        if (buttonText.indexOf("public link") !== -1) publicLinkButton = buttons[i];
      }

      if (!form || !selectEl || !identifierInput || !executeButton) return;

      selectEl.innerHTML = "";
      var orgs = [
        { label: "FEDERAL_RESERVE_SYSTEM", value: "org_gov_federal_reserve", tier: "GOV" },
        { label: "GLOBAL_HEALTH_ALLIANCE", value: "org_gov_global_health", tier: "GOV" },
        { label: "INSTITUTE_OF_ADVANCED_STUDIES", value: "org_gov_advanced_studies", tier: "GOV" },
        { label: "TECHNOVA_PRIVATE_LIMITED", value: "org_pvt_technova", tier: "PVT" },
        { label: "AURORA_DIGITAL_SYSTEMS", value: "org_pvt_aurora_digital", tier: "PVT" },
        { label: "NEXUS_FINTECH_SOLUTIONS", value: "org_pvt_nexus_fintech", tier: "PVT" }
      ];

      for (var j = 0; j < orgs.length; j += 1) {
        var opt = document.createElement("option");
        opt.value = orgs[j].value;
        opt.textContent = orgs[j].label + " (" + orgs[j].tier + ")";
        selectEl.appendChild(opt);
      }

      var state = {
        certUuid: "",
        txHash: "",
        certType: "",
        orgId: ""
      };

      var statusBadge = document.querySelector("[class*='bg-green-100']");
      var txHashLabel = Array.from(document.querySelectorAll("div")).find(function (el) {
        return textContent(el).indexOf("tx_hash:") === 0;
      });
      var title = document.querySelector("h2");
      var subtitle = Array.from(document.querySelectorAll("p")).find(function (el) {
        return textContent(el).indexOf("certification") !== -1 || textContent(el).indexOf("cert type") !== -1;
      });
      var verificationHash = Array.from(document.querySelectorAll("span")).find(function (el) {
        return textContent(el).indexOf("-") !== -1 && textContent(el).length > 10;
      });

      var actionRow = exportButton ? exportButton.parentElement : null;
      var publicLinkWrap = document.createElement("div");
      publicLinkWrap.style.display = "none";
      publicLinkWrap.style.marginTop = "12px";
      publicLinkWrap.style.gap = "8px";
      publicLinkWrap.style.alignItems = "center";
      publicLinkWrap.style.flexWrap = "wrap";

      var publicLinkInput = document.createElement("input");
      publicLinkInput.readOnly = true;
      publicLinkInput.placeholder = "Public link will appear after verification";
      publicLinkInput.style.flex = "1";
      publicLinkInput.style.minWidth = "260px";
      publicLinkInput.style.padding = "8px 10px";
      publicLinkInput.style.border = "1px solid #d1d5db";
      publicLinkInput.style.background = "#ffffff";
      publicLinkInput.style.fontSize = "12px";

      var copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.textContent = "Copy";
      copyButton.style.padding = "8px 12px";
      copyButton.style.border = "1px solid #2d3435";
      copyButton.style.background = "#2d3435";
      copyButton.style.color = "#ffffff";
      copyButton.style.fontSize = "12px";
      copyButton.style.fontWeight = "700";
      copyButton.style.textTransform = "uppercase";

      var qrWrap = document.createElement("div");
      qrWrap.style.display = "none";
      qrWrap.style.width = "100%";
      qrWrap.style.marginTop = "10px";
      qrWrap.style.alignItems = "center";
      qrWrap.style.gap = "12px";

      var qrImage = document.createElement("img");
      qrImage.alt = "Verification public link QR code";
      qrImage.width = 96;
      qrImage.height = 96;
      qrImage.style.width = "96px";
      qrImage.style.height = "96px";
      qrImage.style.border = "1px solid #d1d5db";
      qrImage.style.background = "#ffffff";
      qrImage.style.padding = "4px";

      var qrHint = document.createElement("div");
      qrHint.textContent = "Scan to open verification link";
      qrHint.style.fontSize = "12px";
      qrHint.style.color = "#4b5563";
      qrHint.style.fontWeight = "600";

      qrWrap.appendChild(qrImage);
      qrWrap.appendChild(qrHint);

      publicLinkWrap.appendChild(publicLinkInput);
      publicLinkWrap.appendChild(copyButton);
      publicLinkWrap.appendChild(qrWrap);
      if (actionRow && actionRow.parentElement) {
        actionRow.parentElement.appendChild(publicLinkWrap);
      }

      function setLoading(isLoading) {
        executeButton.disabled = isLoading;
        executeButton.style.opacity = isLoading ? "0.7" : "1";
        executeButton.textContent = isLoading ? "Querying Ledger..." : "Execute Query";
      }

      function setStatus(ok, message) {
        if (!statusBadge) return;
        statusBadge.textContent = message;
        statusBadge.className = ok
          ? "bg-green-100 text-green-800 px-4 py-2 flex items-center gap-2 font-bold text-xs tracking-widest uppercase"
          : "bg-red-100 text-red-700 px-4 py-2 flex items-center gap-2 font-bold text-xs tracking-widest uppercase";
      }

      function createPublicLink() {
        var id = state.certUuid || "preview";
        return window.location.origin + "/verify/" + id;
      }

      function qrUrlFor(link) {
        return "https://api.qrserver.com/v1/create-qr-code/?size=256x256&margin=8&data=" + encodeURIComponent(link);
      }

      function showPublicLinkWithQr(link) {
        publicLinkWrap.style.display = "flex";
        publicLinkInput.value = link;
        qrImage.src = qrUrlFor(link);
        qrWrap.style.display = "flex";
      }

      async function copyLink() {
        if (!publicLinkInput.value) return;
        try {
          await navigator.clipboard.writeText(publicLinkInput.value);
          copyButton.textContent = "Copied";
          setTimeout(function () { copyButton.textContent = "Copy"; }, 1200);
        } catch (_err) {
          publicLinkInput.select();
          document.execCommand("copy");
        }
      }

      async function ensureScript(datasetKey, src, errorCode) {
        var selector = "script[data-" + datasetKey + "='1']";
        var existing = document.querySelector(selector);
        if (existing) {
          if (existing.getAttribute("data-loaded") === "1") return;
          await new Promise(function (resolve, reject) {
            existing.addEventListener("load", function () { resolve(true); }, { once: true });
            existing.addEventListener("error", function () { reject(new Error(errorCode)); }, { once: true });
          });
          return;
        }
        await new Promise(function (resolve, reject) {
          var scriptTag = document.createElement("script");
          scriptTag.src = src;
          scriptTag.async = true;
          scriptTag.setAttribute("data-" + datasetKey, "1");
          scriptTag.onload = function () {
            scriptTag.setAttribute("data-loaded", "1");
            resolve(true);
          };
          scriptTag.onerror = function () { reject(new Error(errorCode)); };
          document.head.appendChild(scriptTag);
        });
      }

      async function ensurePdfLibraries() {
        await ensureScript("jspdf", "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", "jspdf_load_failed");
        await ensureScript("html2canvas", "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js", "html2canvas_load_failed");
        if (!window.jspdf || !window.jspdf.jsPDF || !window.html2canvas) {
          throw new Error("pdf_dependencies_missing");
        }
        return { JsPdf: window.jspdf.jsPDF, html2canvas: window.html2canvas };
      }

      async function exportPdf() {
        try {
          var libs = await ensurePdfLibraries();
          var cardHost = actionRow && actionRow.parentElement ? actionRow.parentElement : null;
          if (!cardHost) {
            throw new Error("certificate_card_missing");
          }

          var exportShell = document.createElement("div");
          exportShell.style.position = "fixed";
          exportShell.style.left = "-99999px";
          exportShell.style.top = "0";
          exportShell.style.width = "1280px";
          exportShell.style.padding = "56px";
          exportShell.style.background = "linear-gradient(180deg, #f3f4f6 0%, #eef0f3 100%)";
          exportShell.style.fontFamily = "Inter, Arial, sans-serif";

          var exportHeader = document.createElement("div");
          exportHeader.style.display = "flex";
          exportHeader.style.justifyContent = "space-between";
          exportHeader.style.alignItems = "center";
          exportHeader.style.marginBottom = "28px";
          exportHeader.innerHTML =
            "<div style='font-weight:800; font-size:30px; letter-spacing:0.02em; color:#20262d;'>VERIFY_LEDGER</div>" +
            "<div style='font-size:13px; color:#4b5563;'>Generated: " + new Date().toLocaleString() + "</div>";

          var clonedCard = cardHost.cloneNode(true);
          clonedCard.style.maxWidth = "100%";
          clonedCard.style.width = "100%";
          clonedCard.style.boxShadow = "0 30px 80px rgba(17, 24, 39, 0.14)";
          clonedCard.style.border = "1px solid #e5e7eb";
          clonedCard.style.background = "#ffffff";

          exportShell.appendChild(exportHeader);
          exportShell.appendChild(clonedCard);
          document.body.appendChild(exportShell);

          var canvas = await libs.html2canvas(exportShell, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#f3f4f6"
          });

          document.body.removeChild(exportShell);

          var imageData = canvas.toDataURL("image/png");
          var doc = new libs.JsPdf({
            orientation: "landscape",
            unit: "mm",
            format: "a4"
          });
          var pageWidth = doc.internal.pageSize.getWidth();
          var pageHeight = doc.internal.pageSize.getHeight();
          var margin = 8;
          var maxWidth = pageWidth - margin * 2;
          var maxHeight = pageHeight - margin * 2;
          var imgRatio = canvas.width / canvas.height;
          var targetWidth = maxWidth;
          var targetHeight = targetWidth / imgRatio;
          if (targetHeight > maxHeight) {
            targetHeight = maxHeight;
            targetWidth = targetHeight * imgRatio;
          }
          var x = (pageWidth - targetWidth) / 2;
          var y = (pageHeight - targetHeight) / 2;
          doc.addImage(imageData, "PNG", x, y, targetWidth, targetHeight);
          doc.save("certificate-verification.pdf");
        } catch (err) {
          console.error("pdf_export_failed", err);
          alert("Could not generate styled PDF right now. Please try again.");
        }
      }

      async function runVerification() {
        setLoading(true);
        try {
          var response = await fetch(apiBaseUrl.replace(/\\/$/, "") + "/api/public/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orgId: selectEl.value,
              certType: "GENERAL",
              identifierValue: identifierInput.value || "CRT-000-XX-8821"
            })
          });

          if (!response.ok) {
            setStatus(false, response.status === 404 ? "Certificate Not Found" : "Verification Failed");
            if (title) title.textContent = "NO MATCH FOUND";
            if (subtitle) subtitle.textContent = "Try a valid organization and certificate identifier.";
            return;
          }

          var data = await response.json();
          state.certUuid = data.certUuid || "";
          state.txHash = data.txHash || "";
          state.certType = data.certType || "GENERAL";
          state.orgId = data.orgId || selectEl.value;

          setStatus(true, "Ledger Verified");
          if (txHashLabel) txHashLabel.textContent = "TX_HASH: " + (data.txHash || "PENDING");
          if (title) title.textContent = "CERTIFICATE VERIFIED";
          if (subtitle) subtitle.textContent = "ORG: " + state.orgId + " | TYPE: " + state.certType;
          if (verificationHash) verificationHash.textContent = data.certUuid || data.txHash || "verified";
        } catch (_error) {
          setStatus(false, "Backend Unreachable");
        } finally {
          setLoading(false);
        }
      }

      form.addEventListener("submit", function (event) {
        event.preventDefault();
        void runVerification();
      });

      executeButton.type = "button";
      executeButton.addEventListener("click", function (event) {
        event.preventDefault();
        void runVerification();
      });

      if (exportButton) {
        exportButton.type = "button";
        exportButton.addEventListener("click", function (event) {
          event.preventDefault();
          void exportPdf();
        });
      }

      if (publicLinkButton) {
        publicLinkButton.type = "button";
        publicLinkButton.addEventListener("click", function (event) {
          event.preventDefault();
          showPublicLinkWithQr(createPublicLink());
        });
      }

      copyButton.addEventListener("click", function (event) {
        event.preventDefault();
        void copyLink();
      });
    }

    bindButtonByLabel("verify now", "/certificate-verification");
    bindButtonByLabel("verify certificate", "/certificate-verification");
    bindButtonByLabel("verify", "/certificate-verification");
    bindButtonByLabel("log in", "/login");
    bindButtonByLabel("login", "/login");
    bindButtonByLabel("sign up", "/signup");
    bindButtonByLabel("signup", "/signup");
    bindButtonByLabel("register entity", "/register-organization");
    bindLinkByLabel("platform", "/");
    bindLinkByLabel("ledger", "/certificate-verification");
    bindLinkByLabel("ecosystem", "/register-organization");
    bindLinkByLabel("docs", "/digital-certificate-view");
    bindLinkByLabel("whitepaper", "/whitepaper");
    bindLinkByLabel("transparency", "/transparency");
    bindLinkByLabel("contact", "/contact");
    bindLinkByLabel("legal", "/legal");
    bindLinkByLabel("connect", "/connect");
    bindLinkByLabel("governance", "/governance");
    bindLabelNavigationDelegation();
    bindBrandToHome();
    replaceWalletWithAuthActions();
    bindRegisterOrganizationInteractions();
    bindVerifyPageInteractions();
  })();
</script>`;return e.includes("</body>")?e.replace("</body>",`${a}</body>`):`${e}${a}`}(e,t.slug);return new u.NextResponse(n,{headers:{"content-type":"text/html; charset=utf-8"}})}catch{return new u.NextResponse("Stitch export file missing",{status:500})}}let y=new r.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/stitch/[slug]/route",pathname:"/stitch/[slug]",filename:"route",bundlePath:"app/stitch/[slug]/route"},resolvedPagePath:"/Users/harshdev/Documents/Projects/docverifyblock/frontend/app/stitch/[slug]/route.ts",nextConfigOutput:"",userland:a}),{requestAsyncStorage:f,staticGenerationAsyncStorage:g,serverHooks:v}=y,m="/stitch/[slug]/route";function b(){return(0,o.patchFetch)({serverHooks:v,staticGenerationAsyncStorage:g})}}};var t=require("../../../webpack-runtime.js");t.C(e);var n=e=>t(t.s=e),a=t.X(0,[942,786],()=>n(297));module.exports=a})();