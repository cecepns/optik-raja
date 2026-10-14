import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Minus,
  User,
  Calendar,
  CheckCircle2,
  FileText,
  UserCheck,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import toast from "react-hot-toast";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { formatRupiah, formatDiopter } from "@/utils/formatters";
import { useDebounce } from "@/hooks/useDebounce";
import { useApp } from "@/context/AppContext";
import ReceiptPrintModal from "@/components/print/ReceiptPrintModal";
import Modal from "@/components/common/Modal";
import Pagination from "@/components/common/Pagination";
import AsyncSelect from "react-select/async";
import ProductImage from "@/components/common/ProductImage";

// Helpers to handle thousands formatting (e.g. 2000 -> "2.000") and clean parsing without leading zero bugs
const parseFormattedNumber = (str) => {
  if (str === "" || str === null || str === undefined) return 0;
  const digits = String(str).replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
};

const formatThousand = (val) => {
  if (val === "" || val === null || val === undefined) return "";
  const num = typeof val === "number" ? val : parseFormattedNumber(val);
  if (!num || num === 0) return "";
  return new Intl.NumberFormat("id-ID").format(num);
};

export default function POSPage() {
  const { currentUser } = useApp();

  // Product search and pagination state
  const [productSearch, setProductSearch] = useState("");
  const debouncedProductSearch = useDebounce(productSearch, 300);
  const [productsList, setProductsList] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productPage, setProductPage] = useState(1);
  const [productLimit, setProductLimit] = useState(15);
  const [productTotalPages, setProductTotalPages] = useState(1);
  const [productTotalItems, setProductTotalItems] = useState(0);

  // Cart state
  const [cartItems, setCartItems] = useState([]);

  // Customer & Prescription state
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerPrescriptions, setCustomerPrescriptions] = useState([]);
  const [selectedPrescription, setSelectedPrescription] = useState(null);

  // Cashier / Employee state
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(currentUser.id || 3);

  // Order Details state
  const [completionEstimate, setCompletionEstimate] = useState(() => {
    // Default 2 days from now
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [orderNotes, setOrderNotes] = useState("");

  // Payment Calculation state
  const [discountAmount, setDiscountAmount] = useState(0);
  const [bpjsClass, setBpjsClass] = useState("none"); // 'none', 'kelas1', 'kelas2', 'kelas3', 'custom'
  const [bpjsSubsidy, setBpjsSubsidy] = useState(0);
  const [paymentType, setPaymentType] = useState("Lunas"); // 'Lunas' or 'DP'
  const [paymentMethod, setPaymentMethod] = useState("Tunai"); // 'Tunai', 'Transfer', 'Split Payment', 'BPJS + Tunai'
  const [paidAmount, setPaidAmount] = useState(0);

  // Modal / Receipt state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustForm, setNewCustForm] = useState({ name: "", phone: "", gender: "Laki-laki", age: "", address: "" });

  // Quick cash preset amounts
  const quickNominals = [50000, 100000, 200000, 500000, 1000000];

  // Load Initial Master Data
  useEffect(() => {
    loadCustomers();
    loadEmployees();
  }, []);

  // Reset page to 1 when search or category filter changes
  useEffect(() => {
    setProductPage(1);
  }, [debouncedProductSearch, selectedCategory]);

  // Search Products & Pagination
  useEffect(() => {
    fetchProducts();
  }, [productPage, productLimit, debouncedProductSearch, selectedCategory]);

  const loadCustomers = async () => {
    try {
      const res = await request.get(API_ENDPOINTS.CUSTOMERS.LIST, { limit: 100 });
      if (res?.data) {
        setCustomers(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Async loader for React Select to search customers via API
  const loadCustomerOptions = async (inputValue) => {
    try {
      const res = await request.get(API_ENDPOINTS.CUSTOMERS.LIST, {
        search: inputValue || "",
        limit: 25,
      });
      if (res?.data) {
        return res.data.map((c) => ({
          value: c.id,
          label: `${c.name} (${c.phone}) - ${c.code}`,
          customer: c,
        }));
      }
      return [];
    } catch (err) {
      console.error("Gagal mencari pelanggan via API:", err);
      return [];
    }
  };

  // Custom styles for React Select matching Tailwind design
  const customerSelectStyles = {
    control: (base, state) => ({
      ...base,
      backgroundColor: "#f8fafc",
      borderColor: state.isFocused ? "#2563eb" : "#cbd5e1",
      borderRadius: "0.75rem",
      padding: "2px 4px",
      boxShadow: state.isFocused ? "0 0 0 3px rgba(37, 99, 235, 0.15)" : "none",
      fontSize: "0.9375rem",
      fontWeight: "500",
      minHeight: "44px",
      transition: "all 0.2s ease",
      "&:hover": {
        borderColor: state.isFocused ? "#2563eb" : "#94a3b8",
      },
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: "#ffffff",
      borderRadius: "0.75rem",
      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
      border: "1px solid #e2e8f0",
      zIndex: 50,
      overflow: "hidden",
      padding: "4px",
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? "#2563eb"
        : state.isFocused
        ? "#eff6ff"
        : "#ffffff",
      color: state.isSelected ? "#ffffff" : "#1e293b",
      borderRadius: "0.5rem",
      padding: "8px 12px",
      fontSize: "0.9375rem",
      cursor: "pointer",
    }),
    placeholder: (base) => ({
      ...base,
      color: "#94a3b8",
      fontSize: "0.875rem",
    }),
    singleValue: (base) => ({
      ...base,
      color: "#0f172a",
      fontWeight: "600",
    }),
    menuPortal: (base) => ({
      ...base,
      zIndex: 9999,
    }),
  };

  const loadEmployees = async () => {
    try {
      const res = await request.get(API_ENDPOINTS.EMPLOYEES.LIST, { limit: 50, is_active: 1 });
      if (res?.data) {
        setEmployees(res.data);
        if (!selectedEmployeeId && res.data.length > 0) {
          setSelectedEmployeeId(res.data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const params = {
        page: productPage,
        limit: productLimit, // 15 products per page
        is_active: 1,
      };
      if (debouncedProductSearch) params.search = debouncedProductSearch;
      if (selectedCategory !== "all") params.category = selectedCategory;

      const res = await request.get(API_ENDPOINTS.PRODUCTS.LIST, params);
      if (res?.data) {
        setProductsList(res.data);
      }
      if (res?.pagination) {
        setProductTotalPages(res.pagination.totalPages || 1);
        setProductTotalItems(res.pagination.total || 0);
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat produk");
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // When customer changes, load customer prescriptions
  const handleSelectCustomer = async (cust) => {
    setSelectedCustomer(cust);
    setSelectedPrescription(null);
    if (!cust) {
      setCustomerPrescriptions([]);
      return;
    }

    try {
      const res = await request.get(API_ENDPOINTS.PRESCRIPTIONS.LIST, { customer_id: cust.id });
      if (res?.data) {
        setCustomerPrescriptions(res.data);
        if (res.data.length > 0) {
          setSelectedPrescription(res.data[0]); // Select latest by default
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add product to cart
  const addToCart = (product) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                total_price: (item.quantity + 1) * item.price - item.discount,
              }
            : item
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          category: product.category,
          image: product.image,
          price: parseFloat(product.selling_price),
          cost_price: parseFloat(product.cost_price),
          quantity: 1,
          discount: 0,
          total_price: parseFloat(product.selling_price),
          notes: "",
        },
      ];
    });
    toast.success(`${product.name} ditambahkan ke keranjang`, { duration: 1500 });
  };

  const updateCartQty = (idx, delta) => {
    setCartItems((prev) =>
      prev
        .map((item, i) => {
          if (i === idx) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return {
              ...item,
              quantity: newQty,
              total_price: newQty * item.price - item.discount,
            };
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removeCartItem = (idx) => {
    setCartItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // BPJS Helper
  const handleBpjsClassChange = (cls) => {
    setBpjsClass(cls);
    if (cls === "kelas1") setBpjsSubsidy(330000);
    else if (cls === "kelas2") setBpjsSubsidy(220000);
    else if (cls === "kelas3") setBpjsSubsidy(165000);
    else if (cls === "none") setBpjsSubsidy(0);
  };

  // Calculations
  const numPaid = Number(paidAmount) || 0;
  const numDiscount = Number(discountAmount) || 0;
  const subtotal = cartItems.reduce((sum, item) => sum + item.total_price, 0);
  const afterDiscount = Math.max(0, subtotal - numDiscount);
  const grandTotal = Math.max(0, afterDiscount - parseFloat(bpjsSubsidy || 0));

  const changeAmount = paymentType === "Lunas" ? Math.max(0, numPaid - grandTotal) : 0;
  const remainingAmount = paymentType === "DP" ? Math.max(0, grandTotal - numPaid) : 0;

  // Auto-set paid amount to grand total when Lunas and paid amount is 0 or less
  const setExactPayment = () => {
    setPaidAmount(grandTotal);
  };

  // Submit Transaction
  const handleCheckout = async (e) => {
    e.preventDefault();

    if (!selectedCustomer) {
      toast.error("Silakan pilih Pelanggan terlebih dahulu!");
      return;
    }
    if (!selectedEmployeeId) {
      toast.error("Silakan pilih Kasir/Pegawai yang bertugas!");
      return;
    }
    if (cartItems.length === 0) {
      toast.error("Keranjang belanja masih kosong!");
      return;
    }
    if (paymentType === "Lunas" && numPaid < grandTotal) {
      toast.error("Nominal pembayaran lunas kurang dari total tagihan!");
      return;
    }
    if (paymentType === "DP" && (numPaid <= 0 || numPaid >= grandTotal)) {
      toast.error("Nominal DP harus lebih dari Rp 0 dan kurang dari total tagihan!");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customer_id: selectedCustomer.id,
        employee_id: selectedEmployeeId,
        prescription_id: selectedPrescription ? selectedPrescription.id : null,
        completion_estimate: completionEstimate,
        items: cartItems,
        subtotal,
        discount_amount: numDiscount,
        bpjs_subsidy: parseFloat(bpjsSubsidy || 0),
        grand_total: grandTotal,
        paid_amount: numPaid,
        change_amount: changeAmount,
        payment_status: paymentType === "DP" ? "DP" : "Lunas",
        payment_method: bpjsSubsidy > 0 ? `BPJS + ${paymentMethod}` : paymentMethod,
        dp_amount: paymentType === "DP" ? numPaid : 0,
        remaining_amount: remainingAmount,
        notes: orderNotes,
      };

      const res = await request.post(API_ENDPOINTS.TRANSACTIONS.CREATE, payload);
      if (res?.success) {
        toast.success("Transaksi kasir berhasil disimpan!");
        setCompletedTransaction({
          ...res.data,
          customer_name: selectedCustomer.name,
          employee_name: employees.find((e) => e.id === Number(selectedEmployeeId))?.name,
          items: cartItems,
        });
        setShowReceiptModal(true);

        // Reset Cart
        setCartItems([]);
        setDiscountAmount(0);
        setBpjsSubsidy(0);
        setBpjsClass("none");
        setPaidAmount(0);
        setOrderNotes("");
      }
    } catch (err) {
      toast.error(err.message || "Gagal memproses transaksi");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Customer Creation
  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!newCustForm.name || !newCustForm.phone) {
      toast.error("Nama dan No WhatsApp wajib diisi");
      return;
    }

    try {
      const res = await request.post(API_ENDPOINTS.CUSTOMERS.CREATE, newCustForm);
      if (res?.success) {
        toast.success("Pelanggan baru berhasil ditambahkan!");
        await loadCustomers();
        await handleSelectCustomer(res.data);
        setShowNewCustomerModal(false);
        setNewCustForm({ name: "", phone: "", gender: "Laki-laki", age: "", address: "" });
      }
    } catch (err) {
      toast.error(err.message || "Gagal membuat data pelanggan");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-blue-600" />
          Kasir POS
        </h2>
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-2xs">
          <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(Number(e.target.value))}
            className="text-xs sm:text-sm font-semibold text-gray-900 bg-transparent focus:outline-none cursor-pointer"
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start">

        {/* ========== LEFT: Product Catalog ========== */}
        <div className="lg:col-span-7 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Search & Filter Header */}
          <div className="p-3 sm:p-4 border-b border-gray-100 bg-white space-y-2.5 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari produk..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none transition-all placeholder:text-gray-400"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {[
                { id: "all", label: "Semua" },
                { id: "Frame", label: "Frame" },
                { id: "Lensa", label: "Lensa" },
                { id: "Aksesori", label: "Aksesori" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    selectedCategory === cat.id
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid Container */}
          <div className="p-3 sm:p-4 bg-slate-50/50">
            {isLoadingProducts ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                {Array.from({ length: Math.min(productLimit, 6) }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 animate-pulse p-3 sm:p-3.5 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <div className="h-3.5 bg-gray-200 rounded w-1/3" />
                      <div className="h-3 bg-gray-100 rounded w-1/4" />
                    </div>
                    <div className="h-4 bg-gray-200 rounded w-4/5" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                    <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                      <div className="h-4 bg-gray-200 rounded w-1/3" />
                      <div className="h-3.5 bg-gray-100 rounded w-1/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : productsList.length === 0 ? (
              <div className="h-full min-h-[220px] flex flex-col items-center justify-center p-8 bg-white rounded-xl border border-dashed border-gray-200 text-center text-gray-400 text-sm">
                <ShoppingBag className="w-10 h-10 mb-2 opacity-30 text-gray-400" />
                <p>Produk tidak ditemukan.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 pb-3">
                {productsList.map((prod) => (
                  <div
                    key={prod.id}
                    onClick={() => addToCart(prod)}
                    className="bg-white rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all duration-150 cursor-pointer group overflow-hidden select-none active:scale-[0.98] flex flex-col justify-between p-3 sm:p-3.5 space-y-2"
                  >
                    {/* Product Info (Foto produk sementara disembunyikan) */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/80">
                          {prod.category}
                        </span>
                        {prod.barcode && (
                          <span className="text-[9px] text-gray-400 font-mono truncate max-w-[80px]">
                            {prod.barcode}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-gray-900 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
                        {prod.name}
                      </h4>
                      {prod.brand && (
                        <p className="text-[11px] text-gray-400 truncate">{prod.brand}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <span className="text-xs sm:text-sm font-extrabold text-blue-700">
                        {formatRupiah(prod.selling_price)}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          prod.stock <= 5
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "text-gray-500 bg-gray-50"
                        }`}
                      >
                        {prod.stock} {prod.unit || "Pcs"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Product Catalog Pagination */}
          <Pagination
            currentPage={productPage}
            totalPages={productTotalPages}
            totalItems={productTotalItems}
            limit={productLimit}
            limitOptions={[4, 8, 12, 15, 30, 45, 60]}
            onPageChange={(p) => {
              setProductPage(p);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onLimitChange={(l) => {
              setProductLimit(l);
              setProductPage(1);
            }}
            compact={true}
            itemName="produk"
          />
        </div>

        {/* ========== RIGHT: Cart & Payment ========== */}
        <div className="lg:col-span-5 lg:sticky lg:top-20 lg:self-start flex flex-col">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-6rem)] overflow-y-auto">

            {/* Customer Picker */}
            <div className="p-3 sm:p-4 border-b border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  Pelanggan <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewCustomerModal(true)}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                >
                  + Baru
                </button>
              </div>
              <AsyncSelect
                cacheOptions
                defaultOptions
                loadOptions={loadCustomerOptions}
                value={
                  selectedCustomer
                    ? {
                        value: selectedCustomer.id,
                        label: `${selectedCustomer.name} (${selectedCustomer.phone}) - ${selectedCustomer.code}`,
                        customer: selectedCustomer,
                      }
                    : null
                }
                onChange={(option) => {
                  handleSelectCustomer(option ? option.customer : null);
                }}
                formatOptionLabel={(option) => {
                  const c = option.customer;
                  if (!c) return option.label;
                  return (
                    <div className="flex items-center justify-between py-0.5">
                      <div>
                        <span className="font-bold text-slate-900 text-sm block leading-tight">{c.name}</span>
                        <span className="text-xs text-slate-500">{c.phone}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                        {c.code}
                      </span>
                    </div>
                  );
                }}
                isClearable
                placeholder="Cari pelanggan..."
                noOptionsMessage={({ inputValue }) =>
                  inputValue ? "Tidak ditemukan" : "Ketik nama atau no HP..."
                }
                loadingMessage={() => "Mencari..."}
                styles={customerSelectStyles}
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              />

              {/* Prescription (collapsible, only when customer selected) */}
              {selectedCustomer && customerPrescriptions.length > 0 && (
                <div className="p-2.5 bg-blue-50/60 rounded-lg border border-blue-100 space-y-1.5">
                  <span className="text-[11px] font-bold text-blue-800 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    Rekam Medis (Resep Kacamata)
                  </span>
                  <select
                    value={selectedPrescription ? selectedPrescription.id : ""}
                    onChange={(e) => {
                      const pid = Number(e.target.value);
                      const rx = customerPrescriptions.find((p) => p.id === pid) || null;
                      setSelectedPrescription(rx);
                    }}
                    className="w-full px-2 py-1.5 text-xs bg-white border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {customerPrescriptions.map((rx) => (
                      <option key={rx.id} value={rx.id}>
                        {rx.exam_date} — {rx.examiner_name}
                      </option>
                    ))}
                  </select>
                  {selectedPrescription && (
                    <div className="text-[10px] bg-white p-2 rounded border border-blue-100 font-mono leading-relaxed">
                      <div className="flex justify-between text-gray-700">
                        <span>OD: {formatDiopter(selectedPrescription.od_sph)} / {formatDiopter(selectedPrescription.od_cyl)} x{selectedPrescription.od_axis}°</span>
                        <span className="text-blue-700 font-bold">Add {formatDiopter(selectedPrescription.od_add)}</span>
                      </div>
                      <div className="flex justify-between text-gray-700">
                        <span>OS: {formatDiopter(selectedPrescription.os_sph)} / {formatDiopter(selectedPrescription.os_cyl)} x{selectedPrescription.os_axis}°</span>
                        <span className="text-blue-700 font-bold">PD {selectedPrescription.total_pd}mm</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Estimated Completion */}
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <label className="text-[11px] font-medium text-gray-500 shrink-0">Estimasi selesai:</label>
                <input
                  type="date"
                  value={completionEstimate}
                  onChange={(e) => setCompletionEstimate(e.target.value)}
                  className="flex-1 px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                />
              </div>
            </div>

            {/* Cart Items */}
            <div className="border-b border-gray-100">
              <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-gray-50/80">
                <span className="text-xs font-bold text-gray-700">
                  Keranjang ({cartItems.length})
                </span>
                {cartItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCartItems([])}
                    className="text-[11px] text-red-500 hover:text-red-700 font-medium"
                  >
                    Hapus Semua
                  </button>
                )}
              </div>

              <div className="max-h-52 sm:max-h-60 overflow-y-auto">
                {cartItems.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 text-xs">
                    <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Belum ada produk dipilih
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {cartItems.map((item, idx) => (
                      <div key={idx} className="px-3 sm:px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50/50 transition-colors">
                        {/* Name & Price */}
                        <div className="flex-1 min-w-0">
                          <h5 className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                            {item.product_name}
                          </h5>
                          <p className="text-[11px] text-gray-400">
                            {formatRupiah(item.price)}
                          </p>
                        </div>

                        {/* Qty Controls */}
                        <div className="flex items-center gap-0.5 shrink-0 bg-gray-100 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => updateCartQty(idx, -1)}
                            className="w-7 h-7 rounded-md hover:bg-white flex items-center justify-center text-gray-600 transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs sm:text-sm font-bold w-7 text-center text-gray-900">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(idx, 1)}
                            className="w-7 h-7 rounded-md hover:bg-white flex items-center justify-center text-gray-600 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Total & Delete */}
                        <div className="text-right shrink-0 min-w-[70px]">
                          <span className="text-xs sm:text-sm font-bold text-gray-900 block">
                            {formatRupiah(item.total_price)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeCartItem(idx)}
                            className="text-[10px] text-red-400 hover:text-red-600 transition-colors"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Discounts, BPJS, Notes */}
            <div className="px-3 sm:px-4 py-3 border-b border-gray-100 space-y-2.5">
              {/* BPJS */}
              <div>
                <label className="text-[11px] font-bold text-gray-600 flex items-center gap-1 mb-1.5">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  BPJS
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { id: "none", label: "Tidak" },
                    { id: "kelas1", label: "Kls 1" },
                    { id: "kelas2", label: "Kls 2" },
                    { id: "kelas3", label: "Kls 3" },
                  ].map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleBpjsClassChange(b.id)}
                      className={`py-1.5 rounded-md text-[11px] font-semibold border transition-colors ${
                        bpjsClass === b.id
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Discount & Notes */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-gray-500 block mb-0.5">Diskon (Rp)</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-400 select-none">
                      Rp
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatThousand(discountAmount)}
                      onChange={(e) => setDiscountAmount(parseFormattedNumber(e.target.value))}
                      className="w-full pl-8 pr-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-500 block mb-0.5">Catatan</label>
                  <input
                    type="text"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Optional..."
                  />
                </div>
              </div>
            </div>

            {/* Price Summary */}
            <div className="px-3 sm:px-4 py-3 bg-gray-50/70 space-y-1 text-xs border-b border-gray-100">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>{formatRupiah(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>Diskon</span>
                  <span>-{formatRupiah(discountAmount)}</span>
                </div>
              )}
              {bpjsSubsidy > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>BPJS ({bpjsClass})</span>
                  <span>-{formatRupiah(bpjsSubsidy)}</span>
                </div>
              )}
              <div className="flex justify-between font-extrabold text-sm sm:text-base text-gray-900 pt-1.5 border-t border-gray-200">
                <span>Total</span>
                <span className="text-blue-700">{formatRupiah(grandTotal)}</span>
              </div>
            </div>

            {/* Payment Section */}
            <div className="px-3 sm:px-4 py-3 space-y-3">
              {/* Payment Status */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setPaymentType("Lunas"); setPaidAmount(grandTotal); }}
                  className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                    paymentType === "Lunas"
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Lunas
                </button>
                <button
                  type="button"
                  onClick={() => { setPaymentType("DP"); setPaidAmount(Math.round(grandTotal / 2)); }}
                  className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                    paymentType === "DP"
                      ? "bg-amber-500 border-amber-500 text-white"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Uang Muka
                </button>
              </div>

              {/* Payment Method */}
              <div className="grid grid-cols-3 gap-1.5">
                {["Tunai", "Transfer", "Split"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m === "Split" ? "Split Payment" : m)}
                    className={`py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                      paymentMethod === (m === "Split" ? "Split Payment" : m)
                        ? "bg-blue-50 border-blue-500 text-blue-700"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {/* Paid Amount */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-gray-600">
                    {paymentType === "DP" ? "Nominal DP" : "Nominal Bayar"}
                  </label>
                  <button
                    type="button"
                    onClick={setExactPayment}
                    className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Uang Pas
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 select-none">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatThousand(paidAmount)}
                    onChange={(e) => setPaidAmount(parseFormattedNumber(e.target.value))}
                    className="w-full pl-9 pr-3 py-2 text-sm font-bold text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="0"
                  />
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {quickNominals.map((nom) => (
                    <button
                      key={nom}
                      type="button"
                      onClick={() => setPaidAmount(nom)}
                      className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md transition-colors cursor-pointer"
                    >
                      {formatRupiah(nom)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Change / Remaining */}
              {paymentType === "Lunas" && changeAmount > 0 && (
                <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 flex justify-between items-center text-xs text-emerald-800 font-bold">
                  <span>Kembalian</span>
                  <span className="text-sm">{formatRupiah(changeAmount)}</span>
                </div>
              )}
              {paymentType === "DP" && (
                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 flex justify-between items-center text-xs text-amber-800 font-bold">
                  <span>Sisa Tagihan</span>
                  <span className="text-sm">{formatRupiah(remainingAmount)}</span>
                </div>
              )}

              {/* Checkout Button */}
              <button
                type="button"
                onClick={handleCheckout}
                disabled={isSubmitting || cartItems.length === 0}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isSubmitting
                  ? "Menyimpan..."
                  : paymentType === "DP"
                  ? `Simpan DP (${formatRupiah(numPaid)})`
                  : `Bayar (${formatRupiah(grandTotal)})`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* New Customer Modal */}
      <Modal
        isOpen={showNewCustomerModal}
        onClose={() => setShowNewCustomerModal(false)}
        title="Tambah Pelanggan Baru"
        subtitle="Data pelanggan untuk rekam medis dan transaksi"
        maxWidth="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowNewCustomerModal(false)}
              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleCreateCustomer}
              className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
            >
              Simpan
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateCustomer} className="space-y-3">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Nama Lengkap <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={newCustForm.name}
              onChange={(e) => setNewCustForm({ ...newCustForm, name: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Contoh: Rian Anggoro"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Nomor HP / WhatsApp <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={newCustForm.phone}
              onChange={(e) => setNewCustForm({ ...newCustForm, phone: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="0812xxxxxxx"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Jenis Kelamin</label>
              <select
                value={newCustForm.gender}
                onChange={(e) => setNewCustForm({ ...newCustForm, gender: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Usia (Tahun)</label>
              <input
                type="number"
                value={newCustForm.age}
                onChange={(e) => setNewCustForm({ ...newCustForm, age: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="30"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Alamat</label>
            <textarea
              rows="2"
              value={newCustForm.address}
              onChange={(e) => setNewCustForm({ ...newCustForm, address: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Alamat domisili pasien..."
            />
          </div>
        </form>
      </Modal>

      {/* Completed Transaction Receipt Modal */}
      <ReceiptPrintModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        transaction={completedTransaction}
      />
    </div>
  );
}
