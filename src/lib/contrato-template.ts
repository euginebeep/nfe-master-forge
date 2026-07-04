import { toast } from "sonner";

/**
 * Template completo do contrato de industrialização por encomenda.
 * Tags dinâmicas usam a sintaxe {{NOME_TAG}}.
 * O sistema substitui automaticamente ao gerar o PDF.
 */

export const TAGS_DISPONIVEIS = [
  // Empresa (Contratada)
  { tag: "EMPRESA_RAZAO_SOCIAL", descricao: "Razão social da empresa (Contratada)", exemplo: "SUA EMPRESA LTDA" },
  { tag: "EMPRESA_CNPJ", descricao: "CNPJ da empresa", exemplo: "52.693.922/0001-25" },
  { tag: "EMPRESA_ENDERECO_COMPLETO", descricao: "Endereço completo da empresa", exemplo: "Rua Venezuela, nº 1680, Bairro America, Barretos/SP, CEP: 14.783-183" },
  { tag: "EMPRESA_CIDADE", descricao: "Cidade da empresa", exemplo: "Barretos" },
  { tag: "EMPRESA_UF", descricao: "UF da empresa", exemplo: "SP" },
  { tag: "EMPRESA_TELEFONE", descricao: "Telefone da empresa", exemplo: "(17) 3322-5299" },
  { tag: "EMPRESA_EMAIL", descricao: "E-mail da empresa", exemplo: "sac@empresa.com.br" },
  { tag: "EMPRESA_REPRESENTANTE", descricao: "Nome do representante legal da empresa", exemplo: "Luiggy Gigliotti Silva" },
  { tag: "EMPRESA_REPRESENTANTE_CPF", descricao: "CPF do representante legal", exemplo: "396.261.898-86" },
  { tag: "EMPRESA_LOGO_URL", descricao: "URL da logo da empresa (cabeçalho)", exemplo: "https://..." },

  // Cliente (Contratante)
  { tag: "CLIENTE_NOME", descricao: "Nome/Razão social do cliente (Contratante)", exemplo: "TOPNUTRIX IMPORTAÇÃO E EXPORTAÇÃO LTDA" },
  { tag: "CLIENTE_DOCUMENTO", descricao: "CNPJ ou CPF do cliente", exemplo: "59.159.281/0001-72" },
  { tag: "CLIENTE_ENDERECO", descricao: "Endereço completo do cliente", exemplo: "AV MIRIM, Nº 150, Bairro Residencial..." },
  { tag: "CLIENTE_REPRESENTANTE", descricao: "Nome do representante do cliente", exemplo: "GILMARA SIMPLICIO DA SILVA" },
  { tag: "CLIENTE_REPRESENTANTE_CPF", descricao: "CPF do representante do cliente", exemplo: "280.926.718-93" },
  { tag: "CLIENTE_REPRESENTANTE_RG", descricao: "RG do representante do cliente", exemplo: "239975352 SSP/SP" },
  { tag: "CLIENTE_EMAIL", descricao: "E-mail do cliente", exemplo: "contato@cliente.com" },
  { tag: "CLIENTE_WHATSAPP", descricao: "WhatsApp do cliente", exemplo: "(11) 99999-9999" },

  // Pedido / Orçamento
  { tag: "PEDIDO_NUMERO", descricao: "Número/código do pedido", exemplo: "ORC-2025-0042" },
  { tag: "PEDIDO_DATA", descricao: "Data do pedido (por extenso)", exemplo: "17 de Março de 2025" },
  { tag: "TABELA_PRODUTOS", descricao: "Tabela HTML dos produtos do pedido (gerada automaticamente)", exemplo: "<table>...</table>" },
  { tag: "VALOR_SUBTOTAL", descricao: "Subtotal do pedido", exemplo: "R$ 90.925,00" },
  { tag: "DESCONTO_PERCENTUAL", descricao: "Desconto em percentual", exemplo: "5%" },
  { tag: "VALOR_DESCONTO", descricao: "Valor do desconto em reais", exemplo: "R$ 4.546,25" },
  { tag: "VALOR_FINAL", descricao: "Valor final do pedido", exemplo: "R$ 86.378,75" },
  { tag: "VALOR_FINAL_EXTENSO", descricao: "Valor final por extenso", exemplo: "OITENTA E SEIS MIL..." },
  { tag: "FORMA_PAGAMENTO", descricao: "Forma de pagamento acordada", exemplo: "50% na confirmação, 50% na NF" },
  { tag: "FORMA_PAGAMENTO_DETALHES", descricao: "Detalhes de pagamento (banco, PIX, etc.)", exemplo: "PIX CNPJ..." },
  { tag: "PRAZO_ENTREGA", descricao: "Prazo de entrega acordado", exemplo: "30 dias úteis após arte do rótulo" },
  { tag: "LOCAL_ENTREGA", descricao: "Local de entrega", exemplo: "Depósito da contratada" },
  { tag: "VENDEDOR_NOME", descricao: "Nome do vendedor", exemplo: "João Silva" },
  { tag: "OBSERVACOES", descricao: "Observações gerais do pedido", exemplo: "Entrega parcial autorizada" },

  // Datas
  { tag: "DATA_CONTRATO", descricao: "Data do contrato (por extenso)", exemplo: "17 de Março de 2025" },
  { tag: "DATA_CONTRATO_CURTA", descricao: "Data do contrato (dd/MM/yyyy)", exemplo: "17/03/2025" },
];

export const CONTRATO_INDUSTRIALIZACAO_TEMPLATE = `CONTRATO DE INDUSTRIALIZAÇÃO POR ENCOMENDA

PARTES:

{{CLIENTE_NOME}}, com sede em {{CLIENTE_ENDERECO}}, inscrita no CNPJ sob nº {{CLIENTE_DOCUMENTO}}, devidamente representada por seu(sua) administrador(a) ({{CLIENTE_REPRESENTANTE}}), brasileiro(a), inscrito(a) no CPF sob o nº {{CLIENTE_REPRESENTANTE_CPF}} RG nº {{CLIENTE_REPRESENTANTE_RG}}, abaixo assinado, neste ato denominada CONTRATANTE.

{{EMPRESA_RAZAO_SOCIAL}}, com sede à {{EMPRESA_ENDERECO_COMPLETO}}, inscrita no CNPJ sob o nº {{EMPRESA_CNPJ}}, devidamente representada por seu administrador {{EMPRESA_REPRESENTANTE}}, inscrito(a) no CPF sob o nº {{EMPRESA_REPRESENTANTE_CPF}}, neste ato denominada CONTRATADA,

Considerando que:

1. a CONTRATADA detém a titularidade da notificação de apresentações junto a Agência Nacional de Vigilância Sanitária (ANVISA), e a fabricação não infringe quaisquer patentes, fórmulas, desenhos e/ou modelos industriais de propriedade de terceiros;
2. a CONTRATADA possui todas as licenças e autorizações para tanto e que atende às Boas Práticas de Fabricação;
3. a CONTRATANTE é empresa que atua no mercado de comercialização e distribuição de produtos alimentícios/chás que é de seu interesse que a CONTRATADA os fabrique sob encomenda;
4. a CONTRATADA, na qualidade de detentora da titularidade da Notificação da apresentação dos produtos fabricados, irá peticionar a adição da marca da CONTRATANTE perante sistema de notificação de suplementos alimentares da ANVISA ou informar uma nova notificação para formulações exclusivas que possuírem testes de estabilidade concluídos.

Têm entre si, de maneira justa e acordada, o presente CONTRATO DE INDUSTRIALIZAÇÃO POR ENCOMENDA, ficando desde já aceito, pelas cláusulas abaixo descritas:

1. DO OBJETO

1.1. O presente tem como OBJETO a industrialização por encomenda, pela CONTRATADA, de produtos alimentícios (suplementos vitamínicos / minerais, alimentos para atletas e/ou novos alimentos devidamente registrados) para a CONTRATANTE, segundo especificações e encomendas desta.

1.2. A industrialização por encomenda se dará mediante a formalização de pedidos de compra (doravante "Pedidos"), dos produtos alimentícios/chás designados nos pedidos e nas notas fiscais emitidas pela CONTRATADA, tudo de acordo com os termos aqui estabelecidos.

1.3. A CONTRATADA se compromete a fornecer a complementação de industrialização em volume, qualidade, prazo e disposições previstas pela CONTRATANTE, em pedidos específicos.

2. DO PROCESSO E DAS NORMAS DE INDUSTRIALIZAÇÃO

2.1. A fabricação dos produtos compreende as etapas da formulação, pesagem e mistura, encapsulamento e/ou compressão de produtos, envase, rotulagem enfardamento e/ou encaixotamento ("Etapas de Fabricação").

2.2. A industrialização será realizada com atendimento das normas do processo produtivo ("know how") e de qualidade, especificadas pela CONTRATADA, de acordo com normas legais que regem as Boas Práticas de Fabricação de Alimentos.

2.3. Na execução da industrialização, a CONTRATADA seguirá as normas de segurança, ambientais e de natureza técnica e sanitária, inerentes ao processo de produção.

2.4. Observadas as especificações liberadas pelo órgão fiscalizador, a matéria prima para industrialização deverá ser remetida pelo(a) CONTRATANTE à CONTRATADA, ou ainda, preferencialmente, adquiridos pela própria CONTRATADA, de fornecedores idôneos, devendo retornar ao CONTRATANTE, devidamente industrializados.

2.5. Para o enfrascamento dos produtos serão utilizadas, exclusivamente, embalagens que estejam de acordo com a notificação específica do produto.

2.6. A rotulagem, cuja arte deverá ser previamente aprovada pela CONTRATADA e pela CONTRATANTE, deverá, obrigatoriamente, respeitar toda a legislação de rotulagem de suplementos alimentares, e conter a informação do fabricante e do distribuidor/comerciante do produto no mercado.

2.7. As despesas de frete, seguro de transporte e estocagem dos materiais a serem industrializados, e seu produto final correrão por conta da negociação em cada pedido a ser realizado, mas em toda e qualquer entrega à CONTRATANTE limitar-se-á até o local de sua sede ou centro de distribuição e/ou estocagem.

2.8. O prazo de fabricação e entrega respeitará o cronograma, agendamento, ordem de pedidos e capacidade e processos fabris da CONTRATADA.

2.9. Este instrumento vincula as partes, portanto, é vedado à CONTRATADA realizar a transferência de suas obrigações na execução das tarefas de industrialização a outrem, salvo se o CONTRATANTE tiver alguma requisição de produto que a CONTRATADA não possa atender em sua planta fabril. Neste caso, mediante acordo bilateral, a CONTRATADA irá terceirizar alguma parte do processo produtivo.

2.10. A CONTRATANTE fornecerá à CONTRATADA toda e qualquer documentação necessária ao cumprimento do objeto do presente contrato.

3. DOS PEDIDOS DE COMPRA

3.1. Os Pedidos formalizados pela CONTRATANTE para a fabricação por encomenda dos Produtos deverão estar completos, contendo, no mínimo, a sua especificação, quantidade, preços, condições de pagamento, programações de entrega e demais condições comerciais relacionadas.

3.2. Após a formalização do Pedido, a CONTRATADA elaborará, no prazo de 5 (cinco) dias, aceite contendo orçamento e previsão de entrega, enviando-o à CONTRATANTE para confirmação, que deverá ser expressa.

3.3. Caso a CONTRATADA não responda o Pedido nos termos e no prazo especificado na cláusula 3.2, o mesmo será considerado aceito, obrigando as partes nos termos deste contrato.

3.4. Em caso de eventual cancelamento pela CONTRATANTE de pedido já confirmado, aplica-se em face desta multa equivalente a 30% (trinta por cento) do valor do pedido. Esta mesma multa se aplica nos casos em que o cancelamento seja efetuado com a mercadoria já produzida, acrescida dos prejuízos ocasionados à CONTRATADA. Em qualquer dos casos retro mencionados, o vencimento da multa, e dos prejuízos, se dará no prazo de 30 (trinta) dias da data da ordem de cancelamento.

4. DA ENTREGA DOS PRODUTOS E OBRIGAÇÕES DA CONTRATANTE

4.1. Será da CONTRATANTE a responsabilidade de arcar com todos os custos de logística e demais incumbências no caso de entrega dos Produtos diretamente à sua sede ou centro de distribuição/estocagem. Esta condição somente será modificada, caso o pedido de fabricação especifique condição diversa, previamente ajustada entre as partes.

4.2. A CONTRATANTE inspecionará os Produtos no momento, possuindo o prazo de até 48 (quarenta e oito) horas para apontar eventual inconformidade do processo fabril, sob pena de aceitação tácita dos Produtos.

4.3. A CONTRATANTE deverá reter qualquer produto não conforme para inspeção da CONTRATADA, devendo ainda disponibilizar, nas suas dependências ou nas da CONTRATADA, um exemplar de Produto não conforme de cada lote.

4.4. Se, após a retenção, a CONTRATADA concordar que o lote não está em conformidade, poderá, à sua escolha e sem custo adicional para a CONTRATANTE, reparar ou substituir o lote não conforme, de modo que o novo lote esteja em conformidade com o Pedido em questão.

5. DO PREÇO E DA FORMA DE PAGAMENTO

5.1. Os Produtos serão adquiridos pela CONTRATANTE pelos preços em vigor na data da aceitação do Pedido ou por aqueles constantes em orçamento formulado pela CONTRATADA, data na qual será realizado o devido faturamento, acompanhando este os Produtos quando de sua entrega.

5.2. A CONTRATANTE pagará à CONTRATADA da seguinte forma:
a) Os pagamentos poderão ser realizados por boleto bancário, cartão de crédito, depósito em conta bancária ou qualquer outra forma previamente ajustada pelas partes e lançadas no pedido. E, caso o pedido não especifique condição diversa, o valor devido será apurado por operação e pago 50% (cinquenta por cento) após a efetivação do PEDIDO junto à CONTRATADA e os outros 50% (cinquenta por cento) na emissão da nota fiscal para despacho do pedido.
b) O preço será, mediante prévio assentimento da CONTRATADA, reajustado quando houver reajustes salariais da classe; ocorrendo alguma modificação nos encargos sociais; ocorrendo alguma modificação na exigência de qualidade, forma, prazo ou apresentação; por aumento de custos tributários decorrentes de mudança na legislação específica e aplicável ao processo de industrialização; ou, ainda, decorrentes de aumento de custos gerais de produção, matérias-primas, embalagens e outros.

5.3. O montante do crédito concedido à CONTRATANTE será especificado em cada operação de compra, de acordo com o limite de crédito previamente estabelecido entre as partes e mediante prévia análise de crédito.

5.4. Os prazos de pagamento das compras realizadas pela CONTRATANTE serão estabelecidos de acordo com as condições acordadas entre as partes em cada operação de compra e constantes dos pedidos e/ou notas fiscais.

5.5. Em caso de atraso no pagamento de qualquer quantia devida nos termos deste contrato, a CONTRATANTE deverá efetuar o pagamento do débito acrescido de multa moratória de 2% (dois por cento), juros de mora de 1% (um por cento) ao mês e correção monetária pro rata die pelo IGP-M/FGV, sem prejuízo da cobrança, pela CONTRATANTE, de todos os custos por ela incorridos para a satisfação de seu crédito, inclusive honorários advocatícios.

5.6. A CONTRATADA se reserva ao direito de protestar o título após 5 (cinco) dias da data do vencimento.

5.7. Os pagamentos não realizados nos termos das cláusulas 5.2 e 5.3 acarretarão a suspensão da fabricação e entrega dos produtos, bem como da confirmação de novos pedidos; e os atrasos superiores a 15 (quinze) dias ensejarão, a critério da CONTRATADA, o cancelamento do pedido e a opção da CONTRATADA pela rescisão unilateral do contrato nos termos da cláusula 11.3. A CONTRATADA poderá, ainda, decorrido o período de 6 (seis) meses da data de finalização da fabricação dos produtos objetos do pedido, sem a confirmação de pagamento para despacho dos itens, realizar o descarte dos mesmos ou conferir outra destinação permitida pelas normas regulamentares.

5.8. Se a CONTRATANTE estiver em mora com qualquer pagamento, tiver excedido o limite de crédito definido pela CONTRATADA ou se esta verificar, a qualquer momento, que a CONTRATANTE está enfrentando ou pode vir a ter problemas com o pagamento dos Pedidos, a CONTRATADA poderá, a seu exclusivo critério: i) Solicitar à CONTRATANTE que pague pelos Pedidos formalizados à vista; ii) Suspender imediatamente a fabricação e todas as entregas; iii) Retomar a posse de quaisquer Produtos em relação aos quais o pagamento ainda não tenha sido plenamente efetuado; iv) Cancelar qualquer desconto inicialmente concedido em benefício da CONTRATANTE.

5.9. Em caso de atraso superior a 60 dias no pagamento de qualquer das parcelas, a CONTRATADA se reserva ao direito de promover a ação judicial cabível.

5.10. Todos os custos, encargos e despesas incorridas pela CONTRATADA no cumprimento de suas obrigações ou relacionadas a este contrato, se causadas por descumprimento da CONTRATANTE, serão pagas pela mesma.

6. DA CONFORMIDADE REGULATÓRIA E DA QUALIDADE DOS PRODUTOS

6.1. A CONTRATADA declara:
i) Que possui capacidade técnica, científica e operacional para fabricar os produtos encomendados;
ii) Que possui alvarás válidos da secretaria do meio ambiente e vigilância sanitária municipal;
iii) Que os Produtos serão fabricados e vendidos em conformidade com as disposições legais aplicáveis;
iv) Que atende as normas relacionadas à habilitação de profissionais para exercer a responsabilidade técnica das suas atividades;
v) Que sua unidade industrial possui autorização de funcionamento e licença do órgão sanitário.

6.2. A CONTRATADA se compromete a disponibilizar à CONTRATANTE, a qualquer tempo, cópias dos documentos que comprovem a sua regularidade e a dos respectivos Produtos.

6.3. A CONTRATADA se compromete a informar, documentalmente, qualquer condição especial associada aos Produtos no tocante ao transporte, acondicionamento, armazenamento e exposição.

6.4. A CONTRATANTE deve manter registros e inventários dos Produtos por todo o período do contrato e, no mínimo, por 5 (cinco) anos a partir da expiração ou rescisão do mesmo.

6.5. A CONTRATANTE se compromete a exigir de seus Clientes que adquirirem os Produtos fabricados pela CONTRATADA para fins de revenda que mantenham registro similar ao referido na cláusula 6.4.

6.6. Caso solicitado mediante notificação por escrito, a CONTRATANTE deverá disponibilizar as informações relacionadas na cláusula 6.4 à CONTRATADA no prazo de 10 (dez) dias.

6.7. A CONTRATANTE se obriga a comercializar e/ou distribuir os Produtos em suas formas, embalagens e rótulos originais, seguindo as recomendações fornecidas pela CONTRATADA, sendo vedado acrescer qualquer outra informação e/ou alteração do conteúdo dos produtos após fabricados.

7. DAS LICENÇAS, MARCAS E DIREITOS CONEXOS

7.1. Todos os registros relativos às marcas dos produtos da CONTRATANTE junto ao INPI são e permanecerão de sua única e exclusiva propriedade.

7.2. Caso alguma marca do produto objeto do presente contrato deixe de ser de responsabilidade da CONTRATANTE, esta deverá comunicar imediatamente a CONTRATADA para que cesse a fabricação dos respectivos produtos.

7.3. Caso a CONTRATANTE não comunique a CONTRATADA acerca do descrito na cláusula acima, qualquer responsabilidade que envolva este assunto é da CONTRATANTE.

7.4. Tomando a CONTRATADA conhecimento da inexistência de registro válido da marca junto ao INPI, poderá, dentro de 30 (trinta) dias, agir, em nome da CONTRATANTE, no devido encaminhamento.

8. DA PUBLICIDADE

8.1. A CONTRATANTE tem conhecimento de que os Produtos são classificados como alimentos perante a ANVISA, sem propriedades medicinais ou terapêuticas, comprometendo-se a:
i) Não alegar, em qualquer hipótese e por qualquer meio, finalidade medicinal ou terapêutica;
ii) Não utilizar vocábulos, sinais, denominações, símbolos ou ilustrações que possam induzir o consumidor a erro.

8.2. Havendo qualquer declaração, propaganda ou rotulagem por parte da CONTRATANTE que desrespeite a cláusula 8.1, esta responderá integralmente pelas consequências daí decorrentes.

8.3. A CONTRATANTE assume toda e qualquer responsabilidade em relação à publicidade realizada em desacordo com a legislação.

9. DAS DECLARAÇÕES, RESPONSABILIDADES, OBRIGAÇÕES E PROIBIÇÕES DAS PARTES

9.1. As partes declaram expressamente:
i) Que seus representantes têm plenos poderes para assinar este contrato;
ii) Que o negócio jurídico está de acordo com as disposições da Lei nº 6.360/76, do Decreto nº 8.077/13;
iii) Que executarão suas obrigações com cuidado e destreza razoáveis.

9.2. A CONTRATADA não terá nenhuma responsabilidade perante a CONTRATANTE ou qualquer terceiro com relação a:
i) Qualquer Produto que tenha sido alterado sem permissão da CONTRATADA;
ii) Qualquer Produto que tenha sido incorretamente armazenado pela CONTRATANTE;
iii) Falta de notificação pela CONTRATANTE acerca de qualquer reivindicação em até 48 horas.

9.3. Não há entre as partes sociedade, consórcio, cooperativismo ou nenhuma outra forma societária.

9.4. A CONTRATANTE reconhece que a atuação da CONTRATADA é limitada à prestação dos serviços de fabricação.

9.5. Os produtos não serão enviados sem a devida assinatura do presente termo.

9.6. Das Obrigações da CONTRATANTE:
9.6.1. Não atribuir qualquer finalidade medicamentosa ou terapêutica aos Produtos.
9.6.2. Encaminhar à CONTRATADA informações sobre o desempenho ou qualidade dos Produtos.
9.6.3. Garantir que qualquer Produto vendido esteja de acordo com as especificações e normas de qualidade.
9.6.4. Informar o endereço de entrega corretamente em até 24 horas da data do faturamento.
9.6.5. Manter a CONTRATADA ciente de qualquer alteração relevante.
9.6.6. Armazenar, comercializar e/ou distribuir os Produtos de acordo com as normas aplicáveis.
9.6.7. Estabelecer e manter procedimentos para identificação de cada lote unitário, garantindo rastreabilidade.
9.6.8. Zelar pelo bom nome comercial da CONTRATADA.
9.6.9. É de responsabilidade exclusiva da CONTRATANTE a destinação final dos Produtos recolhidos.
9.6.10. A CONTRATANTE se obriga a cumprir com os requisitos sanitários, regulatórios e fiscais.
9.6.11. É de inteira responsabilidade da CONTRATANTE os dizeres obrigatórios de rotulagem.
9.6.12. A CONTRATANTE se obriga a receber os produtos tão logo sejam apresentados em seu destino.
9.6.13. A CONTRATANTE estará livre para vender os produtos em qualquer região do país.
9.6.14. A CONTRATANTE responsabilizar-se-á pelos seus representantes comerciais e seus empregados.
9.6.15. A CONTRATANTE se responsabiliza de forma exclusiva pelo uso de imagem de terceiro.
9.6.16. No caso de demanda judicial decorrente de uso de imagem de terceiro, a CONTRATANTE se obriga a arcar com todas as despesas judiciais.
9.6.17. A CONTRATANTE declara estar ciente e se compromete a obedecer toda legislação e normas técnicas.
9.6.18. A CONTRATANTE permite que a utilização das marcas dos produtos para fins de fabricação não acarretará qualquer ônus à CONTRATADA.
9.6.19. Fica a CONTRATANTE responsável por qualquer infração relacionada à utilização das marcas, nome, rótulo, publicidade, marketing e comercialização.
9.6.20. A CONTRATANTE se responsabiliza em apresentar tempestivamente todos os documentos e informações.
9.6.21. A CONTRATANTE é a única responsável pelo conteúdo das publicidades e informações disponibilizadas.
9.6.22. A CONTRATANTE arcará de forma exclusiva e integral com as despesas de penalidades.
9.6.23. Caso a CONTRATADA seja demandada em qualquer processo administrativo ou judicial em razão de atos da CONTRATANTE, esta ficará obrigada a ressarcir.
9.6.24. Eventuais ressarcimentos deverão ser pagos em até 5 (cinco) dias.
9.6.25. Responsabiliza-se a CONTRATANTE a não comercialização de produto impróprio ao consumo.
9.6.26. Fica garantido à CONTRATADA o direito de regresso.
9.6.27. Fica a CONTRATANTE obrigada pela emissão de nota pública de esclarecimento quando necessário.

9.7. Das Obrigações da CONTRATADA:
9.7.1. À CONTRATADA caberá realizar todos os pagamentos devidos aos seus contratados.
9.7.2. A CONTRATADA não se responsabilizará pela divulgação ou propaganda dos produtos fabricados.
9.7.3. A CONTRATADA respeitará a legislação e as normas sanitárias vigentes.
9.7.4. A CONTRATADA assume a responsabilidade pela qualidade técnica dos produtos encomendados.
9.7.5. A CONTRATADA entregará os produtos nas condições previstas neste contrato.
9.7.6. A CONTRATADA garante que está apta e autorizada junto às autoridades brasileiras.
9.7.7. A CONTRATADA deve investigar qualquer reclamação relativa à qualidade técnica.
9.7.8. A CONTRATADA deve manter atualizadas todas as licenças e autorizações necessárias.
9.7.9. A CONTRATADA deve comunicar por escrito qualquer fato que possa interferir na qualidade ou prazo.
9.7.10. Será de inteira responsabilidade da CONTRATADA a qualidade técnica dos produtos.

9.8. Das Proibições da Contratada:
9.8.1. À CONTRATADA é expressamente proibido:
i) utilizar o "know how" de produção da CONTRATANTE para distribuir seus próprios produtos;
ii) alugar, ceder, oferecer consultoria ou utilizar em produtos próprios, sem expressa permissão;
iii) vender, doar, trocar ou distribuir o produto industrializado com a marca da CONTRATANTE;
iv) fazer publicidade e propaganda dos produtos objeto do presente contrato.

10. DA CONFIDENCIALIDADE

10.1. Cada uma das partes compromete-se a manter a confidencialidade das informações relacionadas ao contrato e à sua execução.

10.2. A confidencialidade não se aplica a qualquer informação que a parte receptora possa demonstrar:
i) Que se tornou de domínio público;
ii) Que foi legalmente recebida de terceiro;
iii) Que era de conhecimento da parte receptora antes de sua revelação;
iv) Que foi desenvolvida de forma independente.

10.3. Os termos e condições deste contrato devem ser tratados como informações confidenciais.

10.4. Reputam-se confidenciais todas as informações trocadas entre as partes por qualquer meio.

11. DA VIGÊNCIA E EXTINÇÃO DO CONTRATO

11.1. O presente contrato vigora pelo prazo de 12 (doze) meses a contar da data de sua assinatura, renovando-se automaticamente por igual período.

11.2. Renovado o contrato e tendo transcorrida a vigência de sua renovação, passará a vigorar por prazo indeterminado.

11.3. Constituem justo motivo para a rescisão unilateral e imediata do contrato:
i) A violação contratual sanável não resolvida em 30 dias;
ii) A falência, insolvência, recuperação judicial, liquidação ou dissolução da outra Parte;
iii) A ocorrência de caso fortuito ou de força maior;
iv) A prática de atos de corrupção, violação ao CDC, legislação sanitária e/ou ANVISA;
v) O descumprimento das exigências normativas;
vi) A inadimplência por mais de 15 (quinze) dias;
vii) O descumprimento de quaisquer das cláusulas deste contrato.

11.4. A CONTRATADA desobriga-se a produzir quaisquer Pedidos ainda não aceitos na data da rescisão.

11.5. O encerramento do contrato ensejará a devolução imediata de todos os materiais e bens pertencentes à outra Parte.

11.6. As obrigações relacionadas ao recolhimento dos produtos, publicidade, confidencialidade e propriedade intelectual permanecerão em vigor mesmo após o encerramento do contrato.

12. DA LEGISLAÇÃO E INCIDÊNCIA FISCAL

12.1. As partes se obrigam a observar criteriosamente a legislação que normatiza a indústria e comércio de produtos alimentícios.

12.2. Os tributos e emolumentos devidos em decorrência da industrialização serão de exclusiva responsabilidade da CONTRATADA.

12.3. Os tributos cujo fato gerador seja a comercialização serão de responsabilidade exclusiva da CONTRATANTE.

13. DAS DISPOSIÇÕES FINAIS

13.1. As partes cumprirão as obrigações de acordo com os princípios da lealdade e boa-fé.

13.2. As partes declaram que não praticam e que se absterão da prática de quaisquer atos ilícitos ou de corrupção.

13.3. Todos os avisos e comunicações deverão se dar por escrito e em português.

13.4. As alterações contratuais somente serão válidas mediante aditivo escrito.

13.5. O não exercício de qualquer direito não importará em renúncia.

13.6. As partes possuem personalidades distintas, não se estabelecendo nenhuma forma de sociedade.

13.7. Este contrato não forma vínculo trabalhista entre as partes.

13.8. As partes são responsáveis pelos encargos trabalhistas, fiscais, sociais e previdenciários de seus empregados.

13.9. Se qualquer parte ficar ciente de conflito de interesses, deverá notificar a outra parte imediatamente.

13.10. As partes se obrigam a observar e cumprir rigorosamente todas as leis, normas e procedimentos oficiais.

13.11. A não observação das diretrizes deste termo será considerada infração grave.

13.12. As partes declaram que não ofereceram, prometeram, pagaram ou autorizaram qualquer pagamento ilícito.

13.13. Qualquer violação das declarações antecedentes poderá ensejar a resolução de pleno direito do Contrato.

13.14. A CONTRATADA obriga-se a atuar em conformidade com a LGPD (Lei 13.709/2018).

13.15. As PARTES serão responsáveis por acidentes causados por seus equipamentos, empregados ou contratadas.

13.16. Na hipótese de ação trabalhista ou cível contra qualquer das PARTES, a parte responsável assumirá todo e qualquer ônus.

13.17. Caso qualquer das PARTES seja condenada a realizar pagamento relativo ao pessoal da outra PARTE, a PARTE responsável se compromete a reembolsar integralmente.

13.18. Inexiste qualquer vínculo entre a CONTRATANTE e os empregados da CONTRATADA e vice-versa.

13.19. As partes comprometem-se a proteger e preservar o meio ambiente.

13.20. Este contrato poderá ser modificado a qualquer tempo por mútuo acordo.

13.21. A simples manifestação, omissão ou tolerância não se caracterizará como novação.

13.22. Não se estabelece entre as partes qualquer forma de sociedade, associação, mandato ou representação.

13.23. Este instrumento contém todo o entendimento entre as partes.

13.24. Havendo conflito entre as disposições deste contrato e outros documentos, prevalecerão as cláusulas do presente instrumento.

13.25. Durante a vigência e após o término, a PARTE responsável por multas e penalidades obriga-se ao pagamento integral.

13.26. O presente contrato passa a vigorar a partir de sua assinatura, ficando eleito o foro da cidade de {{EMPRESA_CIDADE}}/{{EMPRESA_UF}}, para dirimirem quaisquer dúvidas.

13.27. As partes desde já acordam que responderá por perdas e danos aquela que infringir quaisquer cláusulas deste contrato.

E, por estarem justas e convencionadas as partes assinam o presente contrato, juntamente com 1 (uma) testemunha.

{{EMPRESA_CIDADE}}/{{EMPRESA_UF}}, {{DATA_CONTRATO}}.


___________________________________________
{{CLIENTE_NOME}}
CNPJ/CPF: {{CLIENTE_DOCUMENTO}}
{{CLIENTE_REPRESENTANTE}}
CONTRATANTE


___________________________________________
{{EMPRESA_RAZAO_SOCIAL}}
CNPJ: {{EMPRESA_CNPJ}}
{{EMPRESA_REPRESENTANTE}}
CONTRATADA


--- PEDIDO DE COMPRA - ANEXO I ---

Este Pedido de Compra é parte integrante do CONTRATO DE INDUSTRIALIZAÇÃO POR ENCOMENDA firmado entre as partes, conforme as cláusulas acordadas, sendo incorporado ao contrato como ANEXO I.

Número do Pedido: {{PEDIDO_NUMERO}}
Data: {{PEDIDO_DATA}}

CONTRATANTE: {{CLIENTE_NOME}}, com sede em {{CLIENTE_ENDERECO}}, inscrita no CNPJ sob nº {{CLIENTE_DOCUMENTO}}, representada por {{CLIENTE_REPRESENTANTE}}.

CONTRATADA: {{EMPRESA_RAZAO_SOCIAL}}, com sede à {{EMPRESA_ENDERECO_COMPLETO}}, inscrita no CNPJ sob o nº {{EMPRESA_CNPJ}}, representada por {{EMPRESA_REPRESENTANTE}}.

1. OBJETO DO PEDIDO

A CONTRATANTE solicita à CONTRATADA a industrialização por encomenda dos seguintes produtos:

{{TABELA_PRODUTOS}}

2. PREÇO E CONDIÇÕES DE PAGAMENTO

Valor Bruto: {{VALOR_SUBTOTAL}}
Desconto: {{DESCONTO_PERCENTUAL}} ({{VALOR_DESCONTO}})
Valor Total: {{VALOR_FINAL}} ({{VALOR_FINAL_EXTENSO}})

3. Forma de Pagamento: {{FORMA_PAGAMENTO}}

{{FORMA_PAGAMENTO_DETALHES}}

4. PRAZO DE ENTREGA: {{PRAZO_ENTREGA}}

Local de entrega: {{LOCAL_ENTREGA}}

5. RESPONSABILIDADE E QUALIDADE

A CONTRATADA compromete-se a fornecer os produtos conforme as especificações técnicas e normas sanitárias exigidas. A CONTRATANTE possui um prazo de 48 (quarenta e oito) horas para apontar qualquer inconformidade do produto recebido.

6. DISPOSIÇÕES GERAIS

Este Pedido de Compra vincula-se ao CONTRATO DE INDUSTRIALIZAÇÃO POR ENCOMENDA, aplicando-se todas as suas cláusulas e condições.

{{EMPRESA_CIDADE}}/{{EMPRESA_UF}}, {{DATA_CONTRATO}}.

{{OBSERVACOES}}

Vendedor: {{VENDEDOR_NOME}}


___________________________________________
{{CLIENTE_NOME}}
CNPJ/CPF: {{CLIENTE_DOCUMENTO}}
CONTRATANTE


___________________________________________
{{EMPRESA_RAZAO_SOCIAL}}
CNPJ: {{EMPRESA_CNPJ}}
CONTRATADA
`;

/**
 * Substitui as tags no template pelo valores reais.
 */
export function substituirTags(
  template: string,
  valores: Record<string, string>
): string {
  let resultado = template;
  for (const [tag, valor] of Object.entries(valores)) {
    const regex = new RegExp(`\\{\\{${tag}\\}\\}`, "g");
    resultado = resultado.replace(regex, valor || "");
  }
  // Limpa tags não preenchidas
  resultado = resultado.replace(/\{\{[A-Z_]+\}\}/g, "_______________");
  return resultado;
}

/**
 * Gera o PDF do contrato via window.print() com formatação profissional A4.
 */
export function gerarContratoPDF(
  textoContrato: string,
  logoUrl?: string,
  empresaNome?: string,
  empresaCnpj?: string,
  empresaEndereco?: string,
  empresaTelefone?: string,
  empresaEmail?: string
) {
  const paragrafos = textoContrato.split("\n").map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return "<br/>";

    // Título principal
    if (trimmed.startsWith("CONTRATO DE INDUSTRIALIZAÇÃO")) {
      return `<h1 class="titulo-principal">${trimmed}</h1>`;
    }
    // Pedido de Compra Anexo
    if (trimmed.startsWith("--- PEDIDO DE COMPRA")) {
      return `<div class="page-break"></div><h1 class="titulo-principal">PEDIDO DE COMPRA - ANEXO I</h1>`;
    }
    // Seção numerada principal (1. DO OBJETO, etc.)
    if (/^\d+\.\s+(DO|DA|DAS|DOS|DAS|PARTES|E,)/.test(trimmed)) {
      return `<h2 class="secao">${trimmed}</h2>`;
    }
    // Sub-seção (1.1., 9.6.1., etc.)
    if (/^\d+\.\d+/.test(trimmed)) {
      return `<p class="subsecao">${trimmed}</p>`;
    }
    // Itens com i), ii), etc.
    if (/^[ivx]+\)/.test(trimmed)) {
      return `<p class="item-romano">${trimmed}</p>`;
    }
    // Itens com a), b), etc.
    if (/^[a-z]\)/.test(trimmed)) {
      return `<p class="item-letra">${trimmed}</p>`;
    }
    // Linhas de assinatura
    if (trimmed.startsWith("___")) {
      return `<div class="linha-assinatura">${trimmed}</div>`;
    }
    // Tabela HTML
    if (trimmed.startsWith("<table")) {
      return trimmed;
    }
    // Considerando que
    if (trimmed === "Considerando que:") {
      return `<h3 class="considerando">${trimmed}</h3>`;
    }
    return `<p>${trimmed}</p>`;
  }).join("\n");

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="Logo" class="logo" style="max-height: 80px; width: auto; object-fit: contain; margin-bottom: 10px;" />`
    : "";

  const rodapeInfo = [empresaNome, empresaEndereco, empresaTelefone && `Fone: ${empresaTelefone}`, empresaEmail && `E-mail: ${empresaEmail}`].filter(Boolean).join(" — ");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Contrato</title>
<style>
  @page { size: A4; margin: 20mm 20mm 25mm 20mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #1a1a1a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .header {
    text-align: center;
    margin-bottom: 15px;
    border-bottom: 2px solid #333;
    padding-bottom: 10px;
  }
  .logo {
    max-height: 60px;
    max-width: 200px;
    margin-bottom: 5px;
  }
  .header .empresa-info {
    font-size: 9pt;
    color: #555;
  }
  .titulo-principal {
    text-align: center;
    font-size: 14pt;
    font-weight: bold;
    margin: 20px 0 15px;
    text-transform: uppercase;
  }
  .secao {
    font-size: 11pt;
    font-weight: bold;
    margin: 18px 0 8px;
    text-transform: uppercase;
  }
  .considerando {
    font-size: 11pt;
    font-weight: bold;
    margin: 15px 0 8px;
  }
  .subsecao {
    text-align: justify;
    margin: 6px 0;
    text-indent: 0;
  }
  p {
    text-align: justify;
    margin: 4px 0;
  }
  .item-romano, .item-letra {
    text-align: justify;
    margin: 3px 0 3px 30px;
  }
  .linha-assinatura {
    text-align: center;
    margin: 30px 0 5px;
    font-size: 11pt;
  }
  .page-break {
    page-break-before: always;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
    margin: 10px 0;
  }
  th {
    background: #e8e8e8;
    font-weight: bold;
    text-align: left;
    padding: 5px 6px;
    border: 1px solid #999;
  }
  td {
    padding: 4px 6px;
    border: 1px solid #ccc;
  }
  tr:nth-child(even) { background: #f7f7f7; }
  .footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 8pt;
    color: #888;
    padding: 5px 20mm;
    border-top: 1px solid #ddd;
  }
  @media screen {
    body { max-width: 800px; margin: 20px auto; padding: 30px; border: 1px solid #ddd; }
  }
</style>
</head>
<body>
  <div class="header" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
    ${logoHtml}
    <div style="margin-top: 5px;">
      ${empresaNome ? `<div class="empresa-info"><strong>${empresaNome}</strong></div>` : ""}
      ${empresaCnpj ? `<div class="empresa-info">CNPJ: ${empresaCnpj}</div>` : ""}
    </div>
  </div>
  ${paragrafos}
  <div class="footer">${rodapeInfo}</div>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) {
    toast.error("Popup bloqueado. Permita popups para gerar o PDF.");
    return;
  }
  w.document.write(html);
  w.document.close();
}
