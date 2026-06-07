import React, { useEffect, useState } from 'react';
import QRCode from 'react-native-qrcode-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';

const API = 'https://nexa-backend-p2u0.onrender.com/api/v1';
const DEFAULT_USDC_BRL_RATE = 5.3;

function Card(props) {
  return <View style={styles.card}>{props.children}</View>;
}

function Button(props) {
  return (
    <TouchableOpacity style={styles.button} onPress={props.onPress}>
      <Text style={styles.buttonText}>{props.title}</Text>
    </TouchableOpacity>
  );
}

function Input(props) {
  return (
    <TextInput
      style={styles.input}
      placeholder={props.placeholder}
      value={props.value}
      onChangeText={props.onChangeText}
      secureTextEntry={props.secureTextEntry || false}
      keyboardType={props.keyboardType || 'default'}
      autoCapitalize={props.autoCapitalize || 'none'}
      autoCorrect={false}
      blurOnSubmit={false}
      returnKeyType="next"
      placeholderTextColor="#64748b"
    />
  );
}

function MenuItem(props) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={props.onPress}>
      <Text style={styles.menuIcon}>{props.icon}</Text>
      <Text style={styles.menuLabel}>{props.label}</Text>
    </TouchableOpacity>
  );
}

export default function App() {
  const [page, setPage] = useState('home');
  const [authPage, setAuthPage] = useState('login');
  const [saldo, setSaldo] = useState({ BRL: 0, USDC: 0 });
  const [extrato, setExtrato] = useState([]);

  const [rewardPlans, setRewardPlans] = useState([]);
  const [rewardPositions, setRewardPositions] = useState([]);
  const [rewardAmount, setRewardAmount] = useState('');
  const [selectedRewardPlan, setSelectedRewardPlan] = useState('SPARK');

  const [marketPrice, setMarketPrice] = useState(DEFAULT_USDC_BRL_RATE);
  const [buyRate, setBuyRate] = useState(DEFAULT_USDC_BRL_RATE);
  const [marketChange, setMarketChange] = useState(0);
  const [priceSource, setPriceSource] = useState('fallback');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');

  const [valorBrl, setValorBrl] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [username, setUsername] = useState('');
  const [recipientUser, setRecipientUser] = useState(null);
  const [recipientChecked, setRecipientChecked] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [newUsername, setNewUsername] = useState('');
  const [valorUsdc, setValorUsdc] = useState('');
  const [wallet, setWallet] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [usdcDepositAddress, setUsdcDepositAddress] = useState('');
  const [usdcDepositQrUrl, setUsdcDepositQrUrl] = useState('');
  const [usdcDepositId, setUsdcDepositId] = useState('');
  const [usdcTxHash, setUsdcTxHash] = useState('');
  const [spendingLimit, setSpendingLimit] = useState(null);
  const [sendPermission, setSendPermission] = useState(null);
  const [newDailyLimit, setNewDailyLimit] = useState('');
  const [limitOtpCode, setLimitOtpCode] = useState('');
  const [limitOtpRequested, setLimitOtpRequested] = useState(false);

  const [depositValue, setDepositValue] = useState('');
  const [pixCopyPaste, setPixCopyPaste] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');

  const [kycStarted, setKycStarted] = useState(false);
  const [kycStep, setKycStep] = useState('personal');

  const [user, setUser] = useState(null);
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState('');
  const [savedEmail, setSavedEmail] = useState('');
  const [savedName, setSavedName] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState('email');

  useEffect(function () {
    carregarLoginSalvo();
    carregarCotacao();
  }, []);

  useEffect(
    function () {
      if (user && user.id) {
        carregarDados();
        buscarPerfilAtualizado();
        carregarCotacao();
        carregarRewards();
        carregarSegurancaWallet();
      }
    },
    [user && user.id],
  );

  function show(data) {
    setMsg(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  }

  function parseAmount(value) {
    const text = String(value || '').trim();

    if (!text) return 0;

    const clean = text
      .replace(/\s/g, '')
      .replace(/R\$/gi, '')
      .replace(/USDC/gi, '')
      .replace(/\./g, '')
      .replace(',', '.');

    const number = Number(clean);

    if (!Number.isFinite(number)) return 0;

    return number;
  }

  function getUsername() {
    if (!user) return '@nexa';
    if (user.handle) return user.handle;
    if (user.username) return '@' + user.username;
    return '@' + String(user.email || user.id).split('@')[0];
  }

  function getKycStatus() {
    if (!user || !user.kycStatus) return 'pending';
    return String(user.kycStatus).toLowerCase();
  }

  function getKycStatusLabel() {
  const status = getKycStatus();

  if (status === 'approved') return 'Aprovado';
  if (status === 'rejected') return 'Reprovado';
  if (status === 'in_review') return 'Em análise';

  return 'Pendente';
}

function isKycApproved() {
  return getKycStatus() === 'approved';
}

  function getWalletAddress() {
    if (!user) return 'Carteira ainda não vinculada';
    if (user.wallet && user.wallet.address) return user.wallet.address;
    if (user.walletAddress) return user.walletAddress;

    return 'Carteira ainda não vinculada';
  }

  function getWalletNetwork() {
    if (user && user.wallet && user.wallet.network) return user.wallet.network;
    if (user && user.walletNetwork) return user.walletNetwork;

    return 'polygon';
  }

  function getInitial() {
    if (!user || !user.fullName) return 'N';
    return user.fullName.charAt(0).toUpperCase();
  }

  function getIcon(item) {
    const description = String(item.description || '').toLowerCase();

    if (description.includes('pix')) return '💳';
    if (description.includes('conversão')) return '🔄';
    if (description.includes('transferência')) return '📤';
    if (description.includes('carteira')) return '🌐';
    if (item.asset === 'USDC') return '💵';

    return '💰';
  }

  function getPriceSourceLabel() {
    if (priceSource === 'coingecko') return 'CoinGecko';
    if (priceSource === 'awesomeapi') return 'AwesomeAPI';

    return 'Cotação Nexa';
  }

  function normalizeUsername(value) {
    return String(value || '').replace('@', '').trim().toLowerCase();
  }

  function getNowLabel() {
    return new Date().toLocaleString('pt-BR');
  }

  async function carregarRewards() {
    if (!user || !user.id) return;

    try {
      const plansResponse = await fetch(API + '/rewards/plans');
      const plansData = await plansResponse.json();

      if (plansData.success) {
        setRewardPlans(plansData.plans || []);
      }

      const positionsResponse = await fetch(
        API + '/rewards/positions?userId=' + user.id,
      );

      const positionsData = await positionsResponse.json();

      if (positionsData.success) {
        setRewardPositions(positionsData.positions || []);
      }
    } catch (e) {
      show('Erro Rewards: ' + e.message);
    }
  }

  async function ativarRewards() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }

    const amount = parseAmount(rewardAmount);

    if (!amount || amount <= 0) {
      show('Informe um valor USDC válido');
      return;
    }

    try {
      const r = await fetch(API + '/rewards/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amountUsdc: amount,
          plan: selectedRewardPlan,
        }),
      });

      const data = await r.json();
      show(data);

      if (data.success) {
        setRewardAmount('');
        carregarRewards();
        carregarDados();
      }
    } catch (e) {
      show('Erro ao ativar Rewards: ' + e.message);
    }
  }

  async function carregarCotacao() {
  try {
    const r = await fetch(API + '/swap/price?symbol=USDC');
    const data = await r.json();

    if (data && data.priceBrl) {
      setMarketPrice(Number(data.priceBrl));
      setBuyRate(Number(data.buyRateBrl || data.priceBrl));
      setMarketChange(Number(data.change24h || 0));
      setPriceSource(data.source || 'api');
    }
  } catch (e) {
    setPriceSource('fallback');
  }
}

  async function buscarDestinatario() {
    const cleanUsername = normalizeUsername(username);

    setRecipientChecked(false);
    setRecipientUser(null);

    if (!cleanUsername) {
      show('Digite um @username para verificar');
      return;
    }

    try {
      const r = await fetch(API + '/user/by-username/' + cleanUsername);
      const data = await r.json();

      setRecipientChecked(true);

      if (data.success && data.user) {
        setRecipientUser(data.user);
        show('Usuário encontrado: ' + data.user.handle);
      } else {
        setRecipientUser(null);
        show('Usuário não encontrado');
      }
    } catch (e) {
      setRecipientChecked(true);
      setRecipientUser(null);
      show('Erro ao verificar usuário: ' + e.message);
    }
  }

  async function vincularWalletPrivy(userData) {
    try {
      if (!userData || !userData.id) return userData;

      const existingAddress = userData.walletAddress || userData.wallet?.address;

      if (existingAddress) return userData;

      const walletResponse = await fetch(API + '/wallet/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userData.id }),
      });

      const walletData = await walletResponse.json();

      if (walletData.success && walletData.walletAddress) {
        return {
          ...userData,
          walletAddress: walletData.walletAddress,
          walletNetwork: walletData.network || 'polygon',
          walletProvider: walletData.provider || 'privy',
        };
      }

      return userData;
    } catch (e) {
      return userData;
    }
  }

  async function salvarSessao(data) {
  const userData = await vincularWalletPrivy(data.user);
  const accessToken = data.accessToken || '';

  setUser(userData);
  setToken(accessToken);

  await AsyncStorage.setItem('nexa_user', JSON.stringify(userData));
  await AsyncStorage.setItem('nexa_token', accessToken);

  if (userData.email) {
    await AsyncStorage.setItem('nexa_last_email', userData.email);
    setSavedEmail(userData.email);
  }

  if (userData.fullName) {
    await AsyncStorage.setItem('nexa_last_name', userData.fullName);
    setSavedName(userData.fullName);
  }
}

  async function atualizarUsuarioLocal(userData) {
    setUser(userData);
    await AsyncStorage.setItem('nexa_user', JSON.stringify(userData));
  }

  async function carregarLoginSalvo() {
  try {
    const savedUser = await AsyncStorage.getItem('nexa_user');
    const savedToken = await AsyncStorage.getItem('nexa_token');
    const lastEmail = await AsyncStorage.getItem('nexa_last_email');
    const lastName = await AsyncStorage.getItem('nexa_last_name');

    if (lastEmail) {
      setEmail(lastEmail);
      setSavedEmail(lastEmail);
      setResetEmail(lastEmail);
    }

    if (lastName) {
      setSavedName(lastName);
    }

    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      setToken(savedToken || '');
      setMsg('Login restaurado');
    }
  } catch (e) {
    setMsg('Erro ao restaurar login: ' + e.message);
  }
}

  async function buscarPerfilAtualizado() {
    try {
      const savedToken = token || (await AsyncStorage.getItem('nexa_token'));

      if (!savedToken) return;

      const r = await fetch(API + '/user/me', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + savedToken,
        },
      });

      const data = await r.json();

      if (data && data.id) {
        await atualizarUsuarioLocal(data);
        setNewUsername(data.username || '');
      }
    } catch (e) {}
  }

  async function login() {
    if (!email || !password) {
      show('Informe e-mail e senha');
      return;
    }

    try {
      const response = await fetch(API + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.accessToken) {
        await salvarSessao(data);
        show('Login realizado com sucesso');
      } else {
        show(data);
      }
    } catch (e) {
      show('Erro login: ' + e.message);
    }
  }

  async function cadastrar() {
    if (!email || !password || !fullName || !cpf || !phone) {
      show('Preencha todos os campos do cadastro');
      return;
    }

    try {
      const response = await fetch(API + '/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, cpf, fullName, phone }),
      });

      const data = await response.json();

      if (data.accessToken) {
        await salvarSessao(data);
        show('Conta criada com sucesso');
      } else {
        show(data);
      }
    } catch (e) {
      show('Erro cadastro: ' + e.message);
    }
  }

  async function salvarUsername() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }

    if (!newUsername) {
      show('Digite um username');
      return;
    }

    try {
      const r = await fetch(API + '/user/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          username: newUsername,
        }),
      });

      const data = await r.json();

      if (data.success && data.user) {
        const updated = {
          ...user,
          username: data.user.username,
          handle: data.user.handle,
        };

        await atualizarUsuarioLocal(updated);
        show('Username atualizado: ' + data.user.handle);
      } else {
        show(data);
      }
    } catch (e) {
      show('Erro username: ' + e.message);
    }
  }

  async function iniciarKyc() {
    try {
      if (!user || !user.id) {
        show('Usuário não encontrado');
        return;
      }

      show('Criando sessão de verificação...');

      const response = await fetch(API + '/kyc/didit/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao iniciar KYC');
      }

      const verificationUrl = data.raw?.url || data.verificationUrl;

      if (!verificationUrl) {
        throw new Error('URL de verificação não recebida');
      }

      show('Abrindo verificação Didit...');
      setKycStarted(true);
      setKycStep('external');

      await Linking.openURL(verificationUrl);
    } catch (error) {
      show(error?.message || 'Falha ao iniciar KYC');
    }
  }

  async function atualizarStatusKyc() {
    try {
      if (!user || !user.id) {
        show('Usuário não encontrado');
        return;
      }

      const response = await fetch(API + '/kyc/didit/status/' + user.id);
      const data = await response.json();

      if (data.success) {
        const updatedUser = {
          ...user,
          kycStatus: data.kycStatus,
          kycVerifiedAt: data.kycVerifiedAt,
        };

        await atualizarUsuarioLocal(updatedUser);
        show('KYC atualizado: ' + data.kycStatus);
        return;
      }

      show(data);
    } catch (e) {
      show('Erro ao atualizar KYC: ' + e.message);
    }
  }

  function avancarKyc() {
    if (kycStep === 'personal') {
      setKycStep('document');
      return;
    }

    if (kycStep === 'document') {
      setKycStep('selfie');
      return;
    }

    if (kycStep === 'selfie') {
      setKycStep('review');
      show('KYC enviado para análise visual');
      return;
    }

    setPage('profile');
  }

  async function logout() {
  await AsyncStorage.removeItem('nexa_user');
  await AsyncStorage.removeItem('nexa_token');

  setUser(null);
  setToken('');
  setPassword('');
  setSaldo({ BRL: 0, USDC: 0 });
  setExtrato([]);
  setPixCopyPaste('');
  setTicketUrl('');
  setLastReceipt(null);
  setPage('home');
  show('Você saiu da Nexa');
}

  async function carregarDados() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }

    try {
      const statementResponse = await fetch(
        API + '/ledger/statement?userId=' + user.id + '&limit=50&mode=real',
      );

      const statementData = await statementResponse.json();

      if (statementData.statement) {
        setExtrato(statementData.statement);
      }

      const balanceResponse = await fetch(
        API + '/ledger/balance?userId=' + user.id + '&mode=real',
      );

      const balanceData = await balanceResponse.json();

      setSaldo({
        BRL: Number(balanceData.balances?.BRL || 0),
        USDC: Number(balanceData.balances?.USDC || 0),
      });

      show('Saldo real atualizado');
    } catch (e) {
      show('Falha ao carregar dados: ' + e.message);
    }
  }

  async function depositarPix() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }

    if (getKycStatus() !== 'approved') {
      show('Conclua sua verificação de identidade antes de depositar Pix');
      setPage('profile');
      return;
    }

    const amount = parseAmount(depositValue);

    if (!amount || amount < 10) {
      show('Depósito mínimo é R$ 10,00');
      return;
    }

    try {
      show('Gerando Pix real...');

      const r = await fetch(API + '/deposit/woovi-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amountBrl: amount,
          customer: {
            name: user.fullName,
            email: user.email,
            phone: user.phone,
            taxID: user.cpf,
          },
        }),
      });

      const data = await r.json();

      if (data.success) {
        setPixCopyPaste(data.copyPasteCode || '');
        setTicketUrl(data.paymentLinkUrl || data.qrCodeImage || '');
        show('Pix real gerado com sucesso');
        return;
      }

      show('Pix Woovi ainda não autorizado. Usando Pix reserva...');

      const fallback = await fetch(API + '/deposit/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amountBrl: amount,
        }),
      });

      const fallbackData = await fallback.json();

      setPixCopyPaste(fallbackData.copyPasteCode || '');
      setTicketUrl(fallbackData.paymentLinkUrl || fallbackData.qrCodeImage || '');

      if (fallbackData.success) {
        show('Pix reserva gerado com sucesso');
      } else {
        show(fallbackData);
      }
    } catch (e) {
      show('Erro depósito Pix: ' + e.message);
    }
  }

  async function converter() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }

    const amount = parseAmount(valorBrl);

    if (!amount || amount <= 0) {
      show('Informe um valor válido em R$');
      return;
    }

    try {
      const r = await fetch(API + '/swap/brl-to-usdc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, amountBrl: amount }),
      });

      const data = await r.json();

      show(data);

      if (data.success) {
        setValorBrl('');
        carregarDados();
        carregarCotacao();
      }
    } catch (e) {
      show('Erro conversão: ' + e.message);
    }
  }

  async function sacarPix() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }

    if (getKycStatus() !== 'approved') {
      show('Conclua sua verificação de identidade antes de sacar Pix');
      setPage('profile');
      return;
    }

    if (!pixKey) {
      show('Informe a chave Pix');
      return;
    }

    const amount = parseAmount(valorBrl);

    if (!amount || amount <= 0) {
      show('Informe um valor válido em R$');
      return;
    }

    try {
      show('Processando saque Pix...');

      const r = await fetch(API + '/payment/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amountBrl: amount,
          pixKey,
        }),
      });

      const data = await r.json();

      if (!r.ok) {
        throw new Error(data.message || data.error || 'Erro ao solicitar saque Pix');
      }

      show(data);

      if (data.success) {
        setValorBrl('');
        setPixKey('');
        carregarDados();

        const receipt = {
          type: 'pix_withdraw',
          status: data.status || 'completed',
          transferId: data.paymentId || data.transactionId || 'pix_' + Date.now(),
          amountUsdc: data.debitedUSDC,
          amountBrl: data.amountBRL,
          destinationName: 'Chave Pix',
          destinationHandle: pixKey,
          fromHandle: getUsername(),
          date: getNowLabel(),
          message: data.message || 'Saque Pix solicitado',
        };

        setLastReceipt(receipt);
        setPage('receipt');
      }
    } catch (e) {
      show('Erro saque Pix: ' + e.message);
    }
  }

  async function enviarUsername() {
    if (getKycStatus() !== 'approved') {
      show('Conclua sua verificação de identidade antes de enviar USDC');
      setPage('profile');
      return;
    }

    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }

    if (!recipientUser) {
      show('Verifique o @username antes de enviar');
      return;
    }

    const amountToSend = parseAmount(valorUsdc);

    if (!amountToSend || amountToSend <= 0) {
      show('Informe um valor USDC válido');
      return;
    }

    try {
      const r = await fetch(API + '/internal-transfer/send-by-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: user.id,
          toUsername: recipientUser.username || normalizeUsername(username),
          amountUsdc: amountToSend,
          note: 'envio app',
        }),
      });

      const data = await r.json();

      show(data);

      if (data.success) {
  const receipt = {
    type: 'internal_transfer',
    status: 'completed',
    transferId: data.transferId || 'internal_' + Date.now(),
    amountUsdc: data.amountUsdc || amountToSend,
    destinationName: recipientUser.fullName,
    destinationHandle: data.handle || recipientUser.handle,
    destinationUsername: data.toUsername || recipientUser.username,
    fromHandle: getUsername(),
    date: getNowLabel(),
    message: data.message || 'Transferência interna concluída',
  };

  setLastReceipt(receipt);
  setUsername('');
  setRecipientUser(null);
  setRecipientChecked(false);
  setValorUsdc('');
  carregarDados();
  setPage('receipt');
}
    } catch (e) {
      show('Erro envio: ' + e.message);
    }
  }

  async function carregarSegurancaWallet() {
  if (!user || !user.id) return;

  try {
    const limitResponse = await fetch(API + '/wallet/spending-limit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    });

    const limitData = await limitResponse.json();

    if (limitData.success) {
      setSpendingLimit(limitData);
    }

    const permissionResponse = await fetch(
      API + '/wallet/usdc-send-permission?userId=' + user.id,
    );

    const permissionData = await permissionResponse.json();

    if (permissionData.success) {
      setSendPermission(permissionData);
    }
  } catch (e) {
    show('Erro segurança wallet: ' + e.message);
  }
}

async function solicitarHabilitacaoEnvioExterno() {
  if (!user || !user.id) {
    show('Faça login primeiro');
    return;
  }

  try {
    const r = await fetch(API + '/wallet/request-usdc-send-enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        note: 'Solicitação feita pelo app Nexa',
      }),
    });

    const data = await r.json();
    show(data);

    if (data.success) {
      carregarSegurancaWallet();
    }
  } catch (e) {
    show('Erro ao solicitar habilitação: ' + e.message);
  }
}

async function criarDepositoUsdcExterno() {
  if (!user || !user.id) {
    show('Faça login primeiro');
    return;
  }

  try {
    show('Gerando endereço para receber USDC...');

    const r = await fetch(API + '/usdc-deposit/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        amountExpected: 0,
      }),
    });

    const data = await r.json();
    show(data);

    if (data.success) {
      setUsdcDepositId(data.depositId || '');
      setUsdcDepositAddress(
        data.treasuryAddress ||
          data.qrCodeValue ||
          '',
      );
      setUsdcDepositQrUrl(data.qrCodeImageUrl || '');
      setUsdcTxHash('');
    }
  } catch (e) {
    show('Erro depósito USDC: ' + e.message);
  }
}

async function solicitarOtpEnvioWallet() {
  if (!user || !user.id) {
    show('Faça login primeiro');
    return;
  }

  const amount = parseAmount(valorUsdc);
  const cleanWallet = String(wallet || '').trim();

  if (!cleanWallet) {
    show('Informe a carteira 0x de destino');
    return;
  }

  if (!cleanWallet.startsWith('0x') || cleanWallet.length !== 42) {
    show('Carteira inválida. O endereço precisa começar com 0x e ter 42 caracteres.');
    return;
  }

  if (!amount || amount <= 0) {
    show('Informe um valor USDC válido');
    return;
  }

  try {
    show('Solicitando código OTP...');

    const payload = {
      userId: user.id,
      toAddress: cleanWallet,
      amountUsdc: amount,
    };

    const r = await fetch(API + '/wallet/send-usdc/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await r.json();

    show({
      status: r.status,
      sentPayload: payload,
      response: data,
    });

    if (r.ok && data.success) {
      setWallet(cleanWallet);
      setOtpRequested(true);
    }
  } catch (e) {
    show('Erro OTP app: ' + e.message);
  }
}
async function solicitarOtpLimiteDiario() {
  if (!user || !user.id) {
    show('Faça login primeiro');
    return;
  }

  const newLimit = parseAmount(newDailyLimit);

  if (!newLimit || newLimit <= 0) {
    show('Informe um novo limite diário válido');
    return;
  }

  try {
    const r = await fetch(API + '/wallet/spending-limit/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        newDailyUsdcLimit: newLimit,
      }),
    });

    const data = await r.json();
    show(data);

    if (data.success) {
      setLimitOtpRequested(true);
    }
  } catch (e) {
    show('Erro OTP limite: ' + e.message);
  }
}

async function confirmarNovoLimiteDiario() {
  if (!user || !user.id) {
    show('Faça login primeiro');
    return;
  }

  const newLimit = parseAmount(newDailyLimit);

  if (!newLimit || newLimit <= 0) {
    show('Informe um novo limite diário válido');
    return;
  }

  if (!limitOtpCode) {
    show('Digite o código OTP recebido por e-mail');
    return;
  }

  try {
    const r = await fetch(API + '/wallet/spending-limit/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        newDailyUsdcLimit: newLimit,
        otpCode: limitOtpCode,
      }),
    });

    const data = await r.json();
    show(data);

    if (data.success) {
      setNewDailyLimit('');
      setLimitOtpCode('');
      setLimitOtpRequested(false);
      carregarSegurancaWallet();
    }
  } catch (e) {
    show('Erro confirmar limite: ' + e.message);
  }
}
  async function enviarWallet() {
    if (getKycStatus() !== 'approved') {
      show('Conclua sua verificação de identidade antes de enviar USDC');
      setPage('profile');
      return;
    }

    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }

    const amount = parseAmount(valorUsdc);

    if (!amount || amount <= 0) {
      show('Informe um valor USDC válido');
      return;
    }

    try {
      const r = await fetch(API + '/wallet/send-usdc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          toAddress: wallet,
          amountUsdc: amount,
          otpCode,
          note: 'envio externo app',
        }),
      });

      const data = await r.json();

      show(data);

            if (data.success) {
        const receipt = {
          type: 'external_wallet',
          status: 'completed',
          transferId: data.transferId,
          amountUsdc: data.amountUsdc || amount,
          destinationName: 'Carteira externa',
          destinationHandle: data.toAddress || wallet,
          fromHandle: getUsername(),
          date: getNowLabel(),
          message: data.message || 'Envio externo concluído',
        };

        setLastReceipt(receipt);
        setWallet('');
        setValorUsdc('');
        setOtpCode('');
        setOtpRequested(false);
        carregarDados();
        setPage('receipt');
      }
    } catch (e) {
      show('Erro wallet: ' + e.message);
    }
  }

  async function solicitarRecuperacaoSenha() {
  const emailToUse = resetEmail || email || savedEmail;

  if (!emailToUse) {
    show('Informe seu e-mail');
    return;
  }

  try {
    const r = await fetch(API + '/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailToUse }),
    });

    const data = await r.json();
    show(data);

    if (data.success) {
      setResetEmail(emailToUse);
      setForgotStep('code');
    }
  } catch (e) {
    show('Erro recuperação: ' + e.message);
  }
}

async function redefinirSenha() {
  if (!resetEmail || !resetCode || !resetNewPassword) {
    show('Informe e-mail, código e nova senha');
    return;
  }

  try {
    const r = await fetch(API + '/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: resetEmail,
        code: resetCode,
        newPassword: resetNewPassword,
      }),
    });

    const data = await r.json();
    show(data);

    if (data.success) {
      setPassword('');
      setResetCode('');
      setResetNewPassword('');
      setAuthPage('login');
      setForgotStep('email');
    }
  } catch (e) {
    show('Erro reset senha: ' + e.message);
  }
}

function formatMoney(value) {
  const number = Number(value || 0);

  return number.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getTransactionTitle(item) {
  const description = String(item.description || '').toLowerCase();

  if (description.includes('pix') && item.direction === 'credit') {
    return 'Depósito Pix';
  }

  if (description.includes('pix') && item.direction === 'debit') {
    return 'Saque Pix';
  }

  if (description.includes('conversão') && item.asset === 'BRL') {
    return 'Compra de USDC';
  }

  if (description.includes('conversão') && item.asset === 'USDC') {
    return 'USDC recebido';
  }

  if (description.includes('transferência') && item.direction === 'debit') {
    return 'USDC enviado';
  }

  if (description.includes('transferência') && item.direction === 'credit') {
    return 'USDC recebido';
  }

  if (item.asset === 'USDC' && item.direction === 'credit') {
    return 'Entrada USDC';
  }

  if (item.asset === 'USDC' && item.direction === 'debit') {
    return 'Saída USDC';
  }

  return item.description || 'Movimentação';
}

function getTransactionSubtitle(item) {
  const asset = item.asset || '';
  const direction = item.direction === 'credit' ? 'Entrada' : 'Saída';

  return `${direction} · ${asset}`;
}

function getTransactionAmountText(item) {
  const sign = item.direction === 'credit' ? '+' : '-';

  if (item.asset === 'BRL') {
    return `${sign} R$ ${formatMoney(item.amount)}`;
  }

  return `${sign} ${Number(item.amount || 0).toFixed(8)} ${item.asset}`;
}

function getTransactionAmountStyle(item) {
  return item.direction === 'credit'
    ? styles.transactionAmountCredit
    : styles.transactionAmountDebit;
}

  if (!user) {
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
      >
        <Text style={styles.logo}>NEXA</Text>
        <Text style={styles.subtitle}>Cripto sem complicação</Text>

        <Card>
          {authPage === 'forgot' ? (
            <>
              <Text style={styles.title}>Recuperar senha</Text>

              {msg ? <Text style={styles.loginMsg}>{msg}</Text> : null}

              {forgotStep === 'email' ? (
                <>
                  <Input
                    placeholder="E-mail"
                    value={resetEmail}
                    onChangeText={setResetEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <Button
                    title="Receber código"
                    onPress={solicitarRecuperacaoSenha}
                  />

                  <Button
                    title="Voltar para login"
                    onPress={function () {
                      setAuthPage('login');
                    }}
                  />
                </>
              ) : (
                <>
                  <Input
                    placeholder="E-mail"
                    value={resetEmail}
                    onChangeText={setResetEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <Input
                    placeholder="Código recebido"
                    value={resetCode}
                    onChangeText={setResetCode}
                    keyboardType="numeric"
                  />

                  <Input
                    placeholder="Nova senha"
                    secureTextEntry={true}
                    value={resetNewPassword}
                    onChangeText={setResetNewPassword}
                  />

                  <Button
                    title="Redefinir senha"
                    onPress={redefinirSenha}
                  />

                  <Button
                    title="Receber novo código"
                    onPress={function () {
                      setForgotStep('email');
                    }}
                  />

                  <Button
                    title="Voltar para login"
                    onPress={function () {
                      setAuthPage('login');
                    }}
                  />
                </>
              )}
            </>
          ) : (
            <>
              <Text style={styles.title}>
                {authPage === 'login' ? 'Entrar' : 'Criar conta'}
              </Text>

              {savedEmail && authPage === 'login' ? (
                <View style={styles.savedLoginBox}>
                  <Text style={styles.savedLoginTitle}>
                    Olá{savedName ? ', ' + savedName.split(' ')[0] : ''} 👋
                  </Text>

                  <Text style={styles.savedLoginEmail}>
                    {savedEmail}
                  </Text>
                </View>
              ) : null}

              {msg ? <Text style={styles.loginMsg}>{msg}</Text> : null}

              {authPage === 'login' && savedEmail ? null : (
                <Input
                  placeholder="E-mail"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              )}

              <Input
                placeholder="Senha"
                secureTextEntry={true}
                value={password}
                onChangeText={setPassword}
              />

              {authPage === 'register' && (
                <>
                  <Input
                    placeholder="Nome completo"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                  />

                  <Input
                    placeholder="CPF"
                    keyboardType="numeric"
                    value={cpf}
                    onChangeText={setCpf}
                  />

                  <Input
                    placeholder="Telefone"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                  />
                </>
              )}

              {authPage === 'login' ? (
                <Button title="Entrar" onPress={login} />
              ) : (
                <Button title="Criar conta" onPress={cadastrar} />
              )}

              {authPage === 'login' && savedEmail ? (
                <Button
                  title="Trocar conta"
                  onPress={async function () {
                    await AsyncStorage.removeItem('nexa_last_email');
                    await AsyncStorage.removeItem('nexa_last_name');
                    setSavedEmail('');
                    setSavedName('');
                    setEmail('');
                    setPassword('');
                    setMsg('');
                  }}
                />
              ) : null}

              {authPage === 'login' ? (
                <>
                  <Button
                    title="Esqueci minha senha"
                    onPress={function () {
                      setResetEmail(savedEmail || email);
                      setAuthPage('forgot');
                    }}
                  />

                  <Button
                    title="Não tenho conta"
                    onPress={function () {
                      setAuthPage('register');
                    }}
                  />
                </>
              ) : (
                <Button
                  title="Já tenho conta"
                  onPress={function () {
                    setAuthPage('login');
                  }}
                />
              )}
            </>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

  const patrimonioTotal = Number((saldo.BRL + saldo.USDC * marketPrice).toFixed(2));
  const walletAddress = getWalletAddress();
  const changePrefix = marketChange >= 0 ? '+' : '';

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
      >
        <Text style={styles.logo}>NEXA</Text>
        <Text style={styles.subtitle}>Pix + USDC + @username</Text>

        {page === 'home' && (
          <>
            <Card>
              <View style={styles.headerRow}>
                <View style={styles.avatarSmall}>
                  <Text style={styles.avatarText}>{getInitial()}</Text>
                </View>

                <View style={styles.headerTextBox}>
                  <Text style={styles.welcome} numberOfLines={1}>
                    Olá, {user.fullName}
                  </Text>

                  <Text style={styles.usernameText}>{getUsername()}</Text>
                  {isKycApproved() ? (
                    <Text style={styles.verifiedBadge}>✅ Verificado</Text>
                  ) : null}
                </View>
              </View>

              <Text style={styles.smallLabel}>Patrimônio total estimado</Text>
              <Text style={styles.totalBalance}>R$ {patrimonioTotal.toFixed(2)}</Text>

              <View style={styles.balanceGrid}>
                <View style={styles.balanceMiniCard}>
                  <Text style={styles.smallLabel}>BRL</Text>
                  <Text style={styles.balanceMiniText}>R$ {saldo.BRL.toFixed(2)}</Text>
                </View>

                <View style={styles.balanceMiniCard}>
                  <Text style={styles.smallLabel}>USDC</Text>
                  <Text style={styles.balanceMiniText}>{saldo.USDC}</Text>
                </View>
              </View>

              <View style={styles.marketBox}>
  <Text style={styles.marketTitle}>USDC</Text>

  <Text style={styles.marketPrice}>
    R$ {buyRate.toFixed(2)}
  </Text>

  <Text style={styles.rateText}>
    Nexa
  </Text>

  <Text style={marketChange >= 0 ? styles.marketUp : styles.marketDown}>
    {changePrefix}
    {marketChange.toFixed(2)}%
  </Text>
</View>

              <Button
                title="Atualizar saldo e cotação"
                onPress={function () {
                  carregarDados();
                  carregarCotacao();
                }}
              />
            </Card>

            <Card>
              <Text style={styles.title}>Notificações</Text>

              <View style={styles.item}>
                <Text style={styles.itemText}>🔔 Bem-vindo à Nexa</Text>
                <Text style={styles.rateText}>Sua conta está pronta para usar.</Text>
              </View>

              <View style={styles.item}>
                <Text style={styles.itemText}>💰 Saldo atualizado</Text>
                <Text style={styles.rateText}>
                  BRL e USDC sincronizados com sua carteira.
                </Text>
              </View>

              {!isKycApproved() ? (
                <View style={styles.item}>
                  <Text style={styles.itemText}>🪪 KYC {getKycStatusLabel()}</Text>
                  <Text style={styles.rateText}>
                    Acompanhe sua verificação de identidade.
                  </Text>
                </View>
              ) : null}

              {lastReceipt ? (
                <View style={styles.item}>
                  <Text style={styles.itemText}>✅ Última transferência concluída</Text>
                  <Text style={styles.rateText}>
                    {lastReceipt.amountUsdc} USDC para {lastReceipt.destinationHandle}
                  </Text>
                </View>
              ) : null}
            </Card>

            <Card>
              <Text style={styles.title}>Ações rápidas</Text>
              <Button title="💳 Depositar Pix" onPress={function () { setPage('deposit'); }} />
              <Button title="🔄 Converter para USDC" onPress={function () { setPage('convert'); }} />
              <Button title="📤 Enviar USDC" onPress={function () { setPage('send'); }} />
              <Button title="🏦 Sacar Pix" onPress={function () { setPage('pix'); }} />
              <Button title="📄 Ver histórico" onPress={function () { setPage('extrato'); }} />
            </Card>

         {!isKycApproved() ? (
            <Card>
              <Text style={styles.title}>Verificação</Text>
              <Text style={styles.itemText}>Status KYC: {getKycStatusLabel()}</Text>
              <Button title="🪪 Iniciar verificação" onPress={iniciarKyc} />
              <Button title="🔄 Atualizar status KYC" onPress={atualizarStatusKyc} />
            </Card>
         ) : null}

            {lastReceipt ? (
              <Card>
                <Text style={styles.title}>Último comprovante</Text>
                <Text style={styles.itemText}>✅ {lastReceipt.message}</Text>
                <Text style={styles.itemText}>Valor: {lastReceipt.amountUsdc} USDC</Text>
                <Text style={styles.itemText}>Destino: {lastReceipt.destinationHandle}</Text>
                <Button title="Ver comprovante" onPress={function () { setPage('receipt'); }} />
              </Card>
            ) : null}

            <Card>
              <Text style={styles.title}>Últimas movimentações</Text>

              {extrato.length === 0 && (
                <Text style={styles.itemText}>Nenhuma movimentação carregada ainda.</Text>
              )}

              {extrato.slice(0, 5).map(function (item) {
                return (
                  <View key={item.id} style={styles.item}>
                    <Text style={styles.itemText}>
                      {getIcon(item)} {item.description}
                    </Text>

                    <Text style={item.direction === 'credit' ? styles.creditText : styles.debitText}>
                      {item.direction === 'credit' ? '+' : '-'} {item.amount} {item.asset}
                    </Text>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {page === 'kyc' && (
          <Card>
            <Text style={styles.title}>Verificação de identidade</Text>
            <Text style={styles.itemText}>Status atual: {getKycStatusLabel()}</Text>

            <View style={styles.kycBox}>
              <Text style={kycStep === 'personal' ? styles.kycActive : styles.kycDone}>1. Dados pessoais</Text>
              <Text style={kycStep === 'document' ? styles.kycActive : styles.kycDone}>2. Documento</Text>
              <Text style={kycStep === 'selfie' ? styles.kycActive : styles.kycDone}>3. Selfie</Text>
              <Text style={kycStep === 'review' ? styles.kycActive : styles.kycPending}>4. Análise</Text>
            </View>

            {kycStep === 'personal' && (
              <>
                <Text style={styles.itemText}>Confirme seus dados pessoais antes de enviar os documentos.</Text>
                <Text style={styles.itemText}>Nome: {user.fullName}</Text>
                <Text style={styles.itemText}>E-mail: {user.email}</Text>
                <Text style={styles.itemText}>CPF: {user.cpf}</Text>
              </>
            )}

            {kycStep === 'document' && (
              <>
                <Text style={styles.itemText}>Envio de documento será integrado no próximo passo.</Text>
                <Text style={styles.rateText}>Aceitaremos RG, CNH ou documento oficial com foto.</Text>
              </>
            )}

            {kycStep === 'selfie' && (
              <>
                <Text style={styles.itemText}>Selfie de segurança será integrada com câmera depois.</Text>
                <Text style={styles.rateText}>Por enquanto, esta etapa é visual para simular o fluxo completo.</Text>
              </>
            )}

            {kycStep === 'review' && (
              <>
                <Text style={styles.itemText}>✅ Verificação enviada para análise.</Text>
                <Text style={styles.rateText}>
                  Quando o backend KYC estiver ativo, esta etapa atualizará o status automaticamente.
                </Text>
              </>
            )}

            <Button title={kycStep === 'review' ? 'Concluir' : 'Continuar'} onPress={avancarKyc} />
            <Button title="Voltar ao Perfil" onPress={function () { setPage('profile'); }} />
          </Card>
        )}

        {page === 'wallet' && (
          <>
            <Card>
              <Text style={styles.title}>Carteira Nexa</Text>

              <View style={styles.walletHeader}>
                <View style={styles.avatarSmall}>
                  <Text style={styles.avatarText}>{getInitial()}</Text>
                </View>

                <View style={styles.headerTextBox}>
                  <Text style={styles.walletName} numberOfLines={1}>{user.fullName}</Text>
                  <Text style={styles.usernameText}>{getUsername()}</Text>
                  {isKycApproved() ? (
                    <Text style={styles.verifiedBadge}>✅ Verificado</Text>
                  ) : null}
                </View>
              </View>

              <Text style={styles.smallLabel}>Patrimônio total estimado</Text>
              <Text style={styles.totalBalance}>R$ {patrimonioTotal.toFixed(2)}</Text>

              <View style={styles.balanceGrid}>
                <View style={styles.balanceMiniCard}>
                  <Text style={styles.smallLabel}>Saldo BRL</Text>
                  <Text style={styles.balanceMiniText}>R$ {saldo.BRL.toFixed(2)}</Text>
                </View>

                <View style={styles.balanceMiniCard}>
                  <Text style={styles.smallLabel}>Saldo USDC</Text>
                  <Text style={styles.balanceMiniText}>{saldo.USDC}</Text>
                </View>
              </View>

              <Button title="Atualizar carteira" onPress={function () { carregarDados(); buscarPerfilAtualizado(); }} />
            </Card>

            <Card>
  <Text style={styles.title}>Receber USDC</Text>

  <TouchableOpacity
  style={styles.item}
  onPress={function () {
    setPage('receive');
  }}
>
  <Text style={styles.itemText}>
    ✅ Receber de usuário Nexa
  </Text>

  <Text style={styles.rateText}>
    Use seu @username para receber USDC instantaneamente dentro da Nexa.
  </Text>

  <Text style={styles.walletAddressText}>
    {getUsername()}
  </Text>

  <Text
    style={{
      color: '#60a5fa',
      marginTop: 8,
      fontWeight: '800',
    }}
  >
    Toque para compartilhar →
  </Text>
</TouchableOpacity>

  <TouchableOpacity
  style={styles.item}
  onPress={function () {
    setPage('receive');
    criarDepositoUsdcExterno();
  }}
>
  <Text style={styles.itemText}>🌐 Receber USDC externo</Text>
  <Text style={styles.rateText}>
    Receba USDC pela rede Polygon usando a carteira Treasury da Nexa.
  </Text>
</TouchableOpacity>

  <View style={styles.item}>
    <Text style={styles.itemText}>📤 Enviar USDC externo</Text>
    <Text style={styles.rateText}>
      Você já pode enviar USDC para uma carteira Polygon informando o endereço 0x.
    </Text>
  </View>
</Card>

            <Card>
              <Text style={styles.title}>Atalhos da carteira</Text>
              <Button title="💳 Depositar Pix" onPress={function () { setPage('deposit'); }} />
              <Button title="🔄 Converter BRL para USDC" onPress={function () { setPage('convert'); }} />
              <Button title="📤 Enviar USDC" onPress={function () { setPage('send'); }} />
              <Button title="💳 Cartão Virtual Nexa" onPress={function () { setPage('card'); }} />
              <Button title="📄 Ver extrato" onPress={function () { setPage('extrato'); }} />
            </Card>
          </>
        )}
       
       {page === 'receive' && (
  <Card>
    <Text style={styles.title}>
      Receber USDC
    </Text>

    <View style={styles.avatarLarge}>
      <Text style={styles.avatarLargeText}>
        {getInitial()}
      </Text>
    </View>

    <View style={styles.receiveBox}>
      <Text style={styles.receiveLabel}>
        Seu usuário Nexa
      </Text>

      <Text style={styles.receiveHandle}>
        {getUsername()}
      </Text>
    </View>

    <Text
      style={{
        color: '#94a3b8',
        textAlign: 'center',
        marginBottom: 16,
      }}
    >
      Compartilhe seu @username para receber
      USDC instantaneamente de outros usuários
      Nexa.
    </Text>

    <View style={styles.pixBox}>
  <Text style={styles.itemText}>Receber USDC externo</Text>
  <Text style={styles.rateText}>
    Envie somente USDC na rede Polygon. Taxa de recebimento: 1%.
  </Text>

  {usdcDepositAddress ? (
  <>
    <View style={styles.qrBox}>
      <QRCode value={usdcDepositAddress} size={180} />
    </View>

    <Text style={styles.itemText}>Endereço:</Text>
    <Text style={styles.copyText}>{usdcDepositAddress}</Text>

    {usdcDepositId ? (
      <>
        <Text style={styles.itemText}>Deposit ID:</Text>
        <Text style={styles.copyText}>{usdcDepositId}</Text>

        <Input
          placeholder="Cole aqui o txHash Polygon"
          value={usdcTxHash}
          onChangeText={setUsdcTxHash}
        />

        <Button
          title="Confirmar recebimento USDC"
          onPress={confirmarDepositoUsdcExterno}
        />
      </>
    ) : null}
  </>
) : (
    <Button
      title="Gerar endereço USDC"
      onPress={criarDepositoUsdcExterno}
    />
  )}
</View>

    <Button
      title="Voltar para carteira"
      onPress={function () {
        setPage('wallet');
      }}
    />
  </Card>
)} 

        {page === 'deposit' && (
          <Card>
            <Text style={styles.title}>Adicionar saldo</Text>
            <Text style={styles.rateText}>Deposite reais instantaneamente via Pix.</Text>

            {msg ? <Text style={styles.loginMsg}>{msg}</Text> : null}

            <Input
              placeholder="Valor em R$"
              keyboardType="numeric"
              value={depositValue}
              onChangeText={setDepositValue}
            />

            <Button title="Depositar via Pix" onPress={depositarPix} />
            {pixCopyPaste ? (
              <View style={styles.pixBox}>
                <Text style={styles.itemText}>QR Code Pix</Text>

                <View style={styles.qrBox}>
                  <QRCode value={pixCopyPaste} size={180} />
                </View>

                <Text style={styles.itemText}>Pix copia e cola:</Text>
                <Text style={styles.copyText}>{pixCopyPaste}</Text>
              </View>
            ) : null}

            {ticketUrl ? (
              <View style={styles.pixBox}>
                <Text style={styles.itemText}>Link de pagamento:</Text>
                <Text style={styles.copyText}>{ticketUrl}</Text>
              </View>
            ) : null}
          </Card>
        )}

        {page === 'pix' && (
          <Card>
            <Text style={styles.title}>Sacar Pix</Text>
            {msg ? <Text style={styles.loginMsg}>{msg}</Text> : null}

            <Input placeholder="Chave Pix" value={pixKey} onChangeText={setPixKey} />

            <Input
              placeholder="Valor em R$"
              keyboardType="numeric"
              value={valorBrl}
              onChangeText={setValorBrl}
            />

            <Button title="Solicitar Pix" onPress={sacarPix} />
          </Card>
        )}

        {page === 'convert' && (
          <Card>
            <Text style={styles.title}>Converter BRL para USDC</Text>
            {msg ? <Text style={styles.loginMsg}>{msg}</Text> : null}

            <Input
              placeholder="Valor em R$"
              keyboardType="numeric"
              value={valorBrl}
              onChangeText={setValorBrl}
            />

            <Text style={styles.rateText}>Cotação atual: 1 USDC = R$ {buyRate.toFixed(2)}</Text>

            <Button title="Converter" onPress={converter} />
          </Card>
        )}

        {page === 'send' && (
          <Card>
            <Text style={styles.title}>Enviar USDC</Text>
            {msg ? <Text style={styles.loginMsg}>{msg}</Text> : null}

            <Input
              placeholder="@username"
              value={username}
              onChangeText={function (value) {
                setUsername(value);
                setRecipientUser(null);
                setRecipientChecked(false);
              }}
            />

            <Button title="Verificar usuário" onPress={buscarDestinatario} />

            {recipientUser ? (
              <View style={styles.recipientBox}>
                <Text style={styles.recipientOk}>✅ Usuário encontrado</Text>
                <Text style={styles.recipientName}>{recipientUser.fullName}</Text>
                <Text style={styles.recipientHandle}>{recipientUser.handle}</Text>
              </View>
            ) : null}

            {!recipientUser && recipientChecked ? (
              <View style={styles.recipientBoxError}>
                <Text style={styles.recipientError}>❌ Usuário não encontrado</Text>
              </View>
            ) : null}

            <Input
              placeholder="Valor USDC"
              keyboardType="numeric"
              value={valorUsdc}
              onChangeText={setValorUsdc}
            />

            <Button title="Enviar para @username" onPress={enviarUsername} />
<Input placeholder="Carteira 0x..." value={wallet} onChangeText={setWallet} />

<Text style={styles.rateText}>
  Envio externo cobra 1% e exige OTP por e-mail.
</Text>

{sendPermission && !sendPermission.enabled ? (
  <View style={styles.item}>
    <Text style={styles.itemText}>🔒 Envio externo não habilitado</Text>
    <Text style={styles.rateText}>
      É necessário saldo mínimo de 100 USDC e aprovação administrativa.
    </Text>

    <Button
      title="Solicitar habilitação"
      onPress={solicitarHabilitacaoEnvioExterno}
    />
  </View>
) : null}

{spendingLimit ? (
  <View style={styles.item}>
    <Text style={styles.itemText}>🛡️ Limite diário</Text>
    <Text style={styles.rateText}>
      Limite: {Number(spendingLimit.limit?.dailyUsdcLimit || 100)} USDC/dia
    </Text>
    <Text style={styles.rateText}>
      Usado hoje: {Number(spendingLimit.usage?.sentToday || 0)} USDC
    </Text>
  </View>
) : null}

<View style={styles.item}>
  <Text style={styles.itemText}>🛡️ Segurança da carteira</Text>

  <Text style={styles.rateText}>
    Limite atual: {Number(spendingLimit?.limit?.dailyUsdcLimit || 100)} USDC/dia
  </Text>

  <Input
    placeholder="Novo limite diário em USDC"
    keyboardType="numeric"
    value={newDailyLimit}
    onChangeText={setNewDailyLimit}
  />

  <Button
    title="Receber OTP para alterar limite"
    onPress={solicitarOtpLimiteDiario}
  />

  {limitOtpRequested ? (
    <>
      <Input
        placeholder="Código OTP do limite"
        keyboardType="numeric"
        value={limitOtpCode}
        onChangeText={setLimitOtpCode}
      />

      <Button
        title="Confirmar novo limite"
        onPress={confirmarNovoLimiteDiario}
      />
    </>
  ) : null}
</View>

<Button title="Receber OTP para enviar USDC" onPress={solicitarOtpEnvioWallet} />

{otpRequested ? (
  <Input
    placeholder="Código OTP recebido por e-mail"
    value={otpCode}
    onChangeText={setOtpCode}
    keyboardType="numeric"
  />
) : null}

<Button title="Enviar para carteira" onPress={enviarWallet} />
          </Card>
        )}

        {page === 'receipt' && (
          <Card>
            <View style={styles.receiptIcon}>
              <Text style={styles.receiptIconText}>✓</Text>
            </View>

            <Text style={styles.receiptTitle}>Transferência concluída</Text>

            {lastReceipt ? (
              <>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Valor</Text>
                  <Text style={styles.receiptValue}>{lastReceipt.amountUsdc} USDC</Text>
                </View>

                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Destino</Text>
                  <Text style={styles.receiptValue}>{lastReceipt.destinationHandle}</Text>
                </View>

                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Nome</Text>
                  <Text style={styles.receiptValue}>{lastReceipt.destinationName}</Text>
                </View>

                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Origem</Text>
                  <Text style={styles.receiptValue}>{lastReceipt.fromHandle}</Text>
                </View>

                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Data</Text>
                  <Text style={styles.receiptValue}>{lastReceipt.date}</Text>
                </View>

                <View style={styles.receiptBox}>
                  <Text style={styles.receiptSmallLabel}>ID da transferência</Text>
                  <Text style={styles.receiptId}>{lastReceipt.transferId}</Text>
                </View>

                <Button title="Voltar para Home" onPress={function () { setPage('home'); }} />
                <Button title="Enviar outro valor" onPress={function () { setPage('send'); }} />
              </>
            ) : (
              <>
                <Text style={styles.itemText}>Nenhum comprovante disponível.</Text>
                <Button title="Voltar para Home" onPress={function () { setPage('home'); }} />
              </>
            )}
          </Card>
        )}

        {page === 'card' && (
          <Card>
            <Text style={styles.title}>Cartão Virtual Nexa</Text>

            <View style={styles.virtualCard}>
              <Text style={styles.cardBrand}>NEXA CARD</Text>
              <Text style={styles.cardNumber}>**** **** **** 2026</Text>
              <Text style={styles.cardName}>{user.fullName}</Text>
              <Text style={styles.cardStatus}>Status: Em breve</Text>
            </View>

            <Text style={styles.smallLabel}>Saldo disponível</Text>
            <Text style={styles.totalBalance}>R$ {patrimonioTotal.toFixed(2)}</Text>

            <Button title="Ativar cartão em breve" onPress={function () { show('Cartão virtual em preparação'); }} />
            <Button title="Voltar para carteira" onPress={function () { setPage('wallet'); }} />
          </Card>
        )}

        {page === 'profile' && (
          <Card>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>{getInitial()}</Text>
            </View>

            <Text style={styles.title}>Perfil</Text>
            <Text style={styles.itemText}>Nome: {user.fullName}</Text>
            <Text style={styles.itemText}>Username atual: {getUsername()}</Text>
            <Text style={styles.itemText}>E-mail: {user.email}</Text>
            <Text style={styles.itemText}>CPF: {user.cpf}</Text>
            <Text style={styles.itemText}>KYC: {getKycStatusLabel()}</Text>

            <Input
              placeholder="Novo username"
              value={newUsername}
              onChangeText={setNewUsername}
              autoCapitalize="none"
            />

            <Button title="Salvar @username" onPress={salvarUsername} />
            {!isKycApproved() ? (
              <Button title="🪪 Verificação de identidade" onPress={iniciarKyc} />
            ) : (
              <View style={styles.verifiedProfileBox}>
                <Text style={styles.verifiedProfileText}>✅ Identidade verificada</Text>
              </View>
            )}
            <Button title="Atualizar perfil" onPress={buscarPerfilAtualizado} />
            <Button title="Sair" onPress={logout} />
          </Card>
        )}

        {page === 'rewards' && (
          <Card>
            <Text style={styles.title}>Nexa Rewards</Text>
            <Text style={styles.rateText}>
              Transforme parte do seu saldo em Saldo Boost e receba cashback de permanência.
            </Text>

            <Text style={styles.smallLabel}>Saldo Livre</Text>
            <Text style={styles.balanceMiniText}>{saldo.USDC} USDC</Text>

            <Input
              placeholder="Valor em USDC"
              keyboardType="numeric"
              value={rewardAmount}
              onChangeText={setRewardAmount}
            />

            {rewardPlans.map(function (plan) {
              return (
                <Button
                  key={plan.plan}
                  title={
                    (selectedRewardPlan === plan.plan ? '✅ ' : '') +
                    plan.name +
                    ' · ' +
                    plan.days +
                    ' dias · ' +
                    (plan.cashbackRate * 100).toFixed(2) +
                    '% cashback'
                  }
                  onPress={function () {
                    setSelectedRewardPlan(plan.plan);
                  }}
                />
              );
            })}

            <Button title="Ativar Saldo Boost" onPress={ativarRewards} />

            <Text style={styles.title}>Meus Boosts</Text>

            {rewardPositions.length === 0 && (
              <Text style={styles.itemText}>Nenhum Saldo Boost ativo.</Text>
            )}

            {rewardPositions.map(function (position) {
              return (
                <View key={position.id} style={styles.item}>
                  <Text style={styles.itemText}>
                    🚀 {position.plan} · {Number(position.amountUsdc).toFixed(4)} USDC
                  </Text>

                  <Text style={styles.rateText}>
                    Liberação: {new Date(position.unlockAt).toLocaleDateString('pt-BR')}
                  </Text>

                  <Text style={styles.rateText}>Status: {position.status}</Text>
                </View>
              );
            })}
          </Card>
        )}

        {page === 'extrato' && (
          <Card>
            <Text style={styles.title}>Histórico Premium</Text>

            <Button title="Atualizar histórico" onPress={carregarDados} />

            {extrato.length === 0 && (
              <Text style={styles.itemText}>Nenhuma movimentação encontrada.</Text>
            )}

            {extrato.map(function (item) {
  return (
    <View key={item.id} style={styles.transactionCard}>
      <View style={styles.transactionIconBox}>
        <Text style={styles.transactionIcon}>
          {getIcon(item)}
        </Text>
      </View>

      <View style={styles.transactionMiddle}>
        <Text style={styles.transactionTitle}>
          {getTransactionTitle(item)}
        </Text>

        <Text style={styles.transactionSubtitle}>
          {getTransactionSubtitle(item)}
        </Text>

        <Text style={styles.transactionDescription}>
          {item.description}
        </Text>
      </View>

      <View style={styles.transactionRight}>
        <Text style={getTransactionAmountStyle(item)}>
          {getTransactionAmountText(item)}
        </Text>

        <Text style={styles.transactionStatus}>
          Concluído
        </Text>
      </View>
    </View>
  );
})}
          </Card>
        )}
      </ScrollView>

      <View style={styles.menu}>
        <MenuItem icon="🏠" label="Home" onPress={function () { setPage('home'); }} />
        <MenuItem icon="👛" label="Carteira" onPress={function () { setPage('wallet'); }} />
        <MenuItem icon="💳" label="Depositar" onPress={function () { setPage('deposit'); }} />
        <MenuItem icon="🔄" label="Converter" onPress={function () { setPage('convert'); }} />
        <MenuItem icon="📤" label="Enviar" onPress={function () { setPage('send'); }} />
        <MenuItem icon="👤" label="Perfil" onPress={function () { setPage('profile'); }} />
        <MenuItem icon="🚀" label="Rewards" onPress={function () { setPage('rewards'); }} />
      </View>
    </View>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#020617' },
  content: { flex: 1, padding: 20, paddingTop: 55 },
  logo: { color: 'white', fontSize: 36, fontWeight: '900', textAlign: 'center', letterSpacing: 2 },
  subtitle: { color: '#93c5fd', textAlign: 'center', marginBottom: 24, fontSize: 13 },
  card: { backgroundColor: '#0f172a', padding: 22, borderRadius: 24, marginBottom: 18, borderWidth: 1, borderColor: '#1e40af' },
  title: { color: 'white', fontSize: 21, fontWeight: '800', marginBottom: 16, marginTop: 6 },

  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  headerTextBox: { flex: 1, minWidth: 0 },

  walletHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  walletName: { color: 'white', fontSize: 18, fontWeight: '900', marginBottom: 4, flexShrink: 1 },
  walletAddressBox: { backgroundColor: '#020617', borderRadius: 14, padding: 13, marginBottom: 14, borderWidth: 1, borderColor: '#334155' },
  walletAddressText: { color: '#93c5fd', fontSize: 12, lineHeight: 18, fontWeight: '800' },

  welcome: { color: 'white', fontSize: 20, fontWeight: '900', marginBottom: 4, flexShrink: 1 },
  usernameText: { color: '#60a5fa', fontSize: 13, fontWeight: '700' },
  verifiedBadge: { color: '#22c55e', fontSize: 12, fontWeight: '900', marginTop: 4 },

  savedLoginBox: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1e40af',
  },
  savedLoginTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  savedLoginEmail: {
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: '700',
  },

  avatarSmall: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  avatarText: { color: 'white', fontSize: 24, fontWeight: '900' },
  avatarLarge: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 18 },
  avatarLargeText: { color: 'white', fontSize: 38, fontWeight: '900' },

  smallLabel: { color: '#94a3b8', fontSize: 13, marginTop: 10, marginBottom: 4 },
  totalBalance: { color: '#ffffff', fontSize: 38, fontWeight: '900', marginBottom: 12 },
  balanceGrid: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 10 },
  balanceMiniCard: { flex: 1, backgroundColor: '#111827', borderRadius: 18, padding: 14 },
  balanceMiniText: { color: 'white', fontWeight: '900', fontSize: 18 },

  rateText: { color: '#93c5fd', fontSize: 12, marginBottom: 14 },
  loginMsg: { color: '#93c5fd', marginBottom: 15, textAlign: 'center', fontSize: 13 },

  marketBox: { backgroundColor: '#111827', borderRadius: 18, padding: 14, marginTop: 8, marginBottom: 14 },
  marketTitle: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  marketPrice: { color: 'white', fontSize: 24, fontWeight: '900', marginTop: 4 },
  marketUp: { color: '#22c55e', fontSize: 12, fontWeight: '800', marginTop: 3 },
  marketDown: { color: '#f87171', fontSize: 12, fontWeight: '800', marginTop: 3 },

  kycBox: { backgroundColor: '#111827', borderRadius: 16, padding: 14, marginBottom: 14 },
  kycActive: { color: '#93c5fd', fontSize: 14, fontWeight: '900', marginBottom: 8 },
  kycDone: { color: '#22c55e', fontSize: 14, fontWeight: '800', marginBottom: 8 },
  kycPending: { color: '#94a3b8', fontSize: 14, fontWeight: '700', marginBottom: 8 },

  recipientBox: { backgroundColor: '#052e16', borderColor: '#22c55e', borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
  recipientBoxError: { backgroundColor: '#450a0a', borderColor: '#ef4444', borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
  recipientOk: { color: '#22c55e', fontSize: 12, fontWeight: '900', marginBottom: 5 },
  recipientError: { color: '#fca5a5', fontSize: 12, fontWeight: '900' },
  recipientName: { color: 'white', fontSize: 16, fontWeight: '900', marginBottom: 3 },
  recipientHandle: { color: '#93c5fd', fontSize: 13, fontWeight: '700' },

  receiptIcon: { width: 82, height: 82, borderRadius: 41, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 18 },
  receiptIconText: { color: 'white', fontSize: 42, fontWeight: '900' },
  receiptTitle: { color: 'white', fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 20 },
  receiptRow: { backgroundColor: '#111827', borderRadius: 14, padding: 13, marginBottom: 10 },
  receiptLabel: { color: '#94a3b8', fontSize: 12, marginBottom: 4 },
  receiptValue: { color: 'white', fontSize: 15, fontWeight: '900' },
  receiptBox: { backgroundColor: '#020617', borderRadius: 14, padding: 13, marginBottom: 14, borderWidth: 1, borderColor: '#334155' },
  receiptSmallLabel: { color: '#94a3b8', fontSize: 11, marginBottom: 5 },
  receiptId: { color: '#93c5fd', fontSize: 12, fontWeight: '800' },

  verifiedProfileBox: { backgroundColor: '#052e16', borderColor: '#22c55e', borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 12 },
  verifiedProfileText: { color: '#22c55e', textAlign: 'center', fontWeight: '900', fontSize: 14 },

  virtualCard: { backgroundColor: '#1e3a8a', borderRadius: 22, padding: 22, marginBottom: 18, minHeight: 190, justifyContent: 'space-between' },
  cardBrand: { color: '#bfdbfe', fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  cardNumber: { color: 'white', fontSize: 24, fontWeight: '900', marginTop: 34, letterSpacing: 2 },
  cardName: { color: '#e0f2fe', fontSize: 14, fontWeight: '800', marginTop: 24 },
  cardStatus: { color: '#93c5fd', fontSize: 12, fontWeight: '700', marginTop: 8 },

  input: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 14, marginBottom: 12, fontSize: 15 },
  button: { backgroundColor: '#2563eb', padding: 13, borderRadius: 14, marginBottom: 11 },
  buttonText: { color: 'white', textAlign: 'center', fontWeight: '800', fontSize: 15 },

  menu: { height: 78, backgroundColor: '#020617', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: '#1e293b' },
  menuItem: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  menuIcon: { color: '#e2e8f0', fontSize: 18 },
  menuLabel: { color: '#94a3b8', fontSize: 9, marginTop: 2, fontWeight: '700' },

  item: { backgroundColor: '#111827', borderRadius: 14, padding: 12, marginBottom: 10 },
  itemText: { color: '#f8fafc', marginBottom: 6, fontSize: 13 },
  creditText: { color: '#22c55e', fontWeight: '900', fontSize: 14 },
  debitText: { color: '#f87171', fontWeight: '900', fontSize: 14 },

  pixBox: { backgroundColor: '#020617', padding: 14, borderRadius: 16, marginTop: 12, borderWidth: 1, borderColor: '#1e293b' },
  copyText: { color: '#cbd5e1', fontSize: 11, lineHeight: 16 },
qrBox: { backgroundColor: 'white', padding: 16, borderRadius: 18, alignSelf: 'center', marginBottom: 16 },

transactionCard: {
  backgroundColor: '#111827',
  borderRadius: 18,
  padding: 14,
  marginBottom: 12,
  borderWidth: 1,
  borderColor: '#1e293b',
  flexDirection: 'row',
  alignItems: 'center',
},

transactionIconBox: {
  width: 42,
  height: 42,
  borderRadius: 21,
  backgroundColor: '#020617',
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 12,
},

transactionIcon: {
  fontSize: 20,
},

transactionMiddle: {
  flex: 1,
  paddingRight: 8,
},

transactionTitle: {
  color: 'white',
  fontWeight: '900',
  fontSize: 14,
  marginBottom: 3,
},

transactionSubtitle: {
  color: '#93c5fd',
  fontWeight: '700',
  fontSize: 11,
  marginBottom: 3,
},

transactionDescription: {
  color: '#64748b',
  fontSize: 10,
},

transactionRight: {
  alignItems: 'flex-end',
  maxWidth: 110,
},

transactionAmountCredit: {
  color: '#22c55e',
  fontWeight: '900',
  fontSize: 13,
  textAlign: 'right',
},

transactionAmountDebit: {
  color: '#f87171',
  fontWeight: '900',
  fontSize: 13,
  textAlign: 'right',
},

transactionStatus: {
  color: '#64748b',
  fontSize: 10,
  marginTop: 4,
},

receiveBox: {
  backgroundColor: '#020617',
  borderRadius: 18,
  padding: 18,
  marginBottom: 14,
  borderWidth: 1,
  borderColor: '#1e40af',
  alignItems: 'center',
},

receiveLabel: {
  color: '#94a3b8',
  fontSize: 12,
  marginBottom: 6,
},

receiveHandle: {
  color: '#60a5fa',
  fontSize: 28,
  fontWeight: '900',
},
};
